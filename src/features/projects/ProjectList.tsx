"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AgreementSeal } from "@/components/ui/AgreementSeal";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/Chip";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FitPair } from "@/components/ui/FitBadge";
import { Icon } from "@/components/ui/Icon";
import { Callout, EmptyState, Panel, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileStrip } from "@/components/ui/ProfileStrip";
import { useToast } from "@/components/ui/Toast";
import { effectiveFit } from "@/lib/balance";
import { api, download, errMessage } from "@/lib/apiClient";
import { can } from "@/lib/auth/permissions";
import { buildProfile } from "@/lib/fitness";
import { labelOf, useApi, useRefs } from "@/lib/hooks";
import { FIT_LABEL, fmtDateTime, fmtRelative, STATUS_LABEL } from "@/lib/labels";
import { FITS, STATUSES, type Project, type ProjectStatus } from "@/lib/types";
import { BulkBar } from "./BulkBar";
import s from "./projects.module.css";

const FILTER_KEYS = ["q", "status", "fit", "devType", "sysType", "lang", "domain", "pm"] as const;

export function ProjectList() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { me } = useAuth();
  const { criteria, codes } = useRefs();
  const { toast, toastError } = useToast();
  const query = sp.toString();
  const { data, loading, error, reload } = useApi<Project[]>(`/api/projects${query ? `?${query}` : ""}`);
  const { data: pms } = useApi<{ userId: string; userNm: string }[]>("/api/users/options?role=PM");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState(sp.get("q") ?? "");

  function setParam(key: (typeof FILTER_KEYS)[number], value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    setSelected(new Set());
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  }

  const activeFilters = FILTER_KEYS.filter((k) => sp.get(k)).length;
  const rows = data ?? [];
  const dist = useMemo(() => {
    const d = { H: 0, M: 0, L: 0, NA: 0 };
    for (const p of rows) d[effectiveFit(p)]++;
    return d;
  }, [rows]);

  const columns: Column<Project>[] = [
    {
      key: "prjId",
      header: "코드",
      width: 92,
      render: (p) => <span className="num subtle">{p.prjId}</span>,
      sortValue: (p) => p.prjId,
    },
    {
      key: "prjNm",
      header: "과제",
      render: (p) => (
        <div className={s.nameCell}>
          <Link href={`/projects/${p.prjId}`} className={s.name} onClick={(e) => e.stopPropagation()}>
            {p.prjNm}
          </Link>
          <span className="subtle">{p.sysNm || "—"}</span>
        </div>
      ),
      sortValue: (p) => p.prjNm,
    },
    { key: "pm", header: "PM", width: 90, render: (p) => p.pmUserNm, sortValue: (p) => p.pmUserNm },
    {
      key: "dev",
      header: "과제 영역",
      width: 100,
      render: (p) => labelOf(codes?.workAreas, p.devTypeCd),
      sortValue: (p) => p.devTypeCd ?? "",
    },
    {
      key: "lang",
      header: "언어",
      width: 140,
      render: (p) => (
        <span className={s.langs}>
          {p.base.langCds.slice(0, 2).map((l) => labelOf(codes?.langs, l)).join(", ") || "—"}
          {p.base.langCds.length > 2 && <span className="subtle"> +{p.base.langCds.length - 2}</span>}
        </span>
      ),
    },
    {
      key: "profile",
      header: "지표 입력",
      width: 190,
      render: (p) => (criteria ? <ProfileStrip profile={buildProfile(criteria, p.eval.answers)} size="md" /> : null),
    },
    {
      key: "fit",
      header: "적합도",
      width: 80,
      align: "center",
      render: (p) => <FitPair finalFit={p.finalFit} suggestFit={p.suggestFit} size="sm" />,
      sortValue: (p) => ({ H: 0, M: 1, L: 2, NA: 3 })[effectiveFit(p)],
    },
    {
      key: "answers",
      header: "응답",
      width: 64,
      align: "right",
      render: (p) => (
        <span className={`num ${p.answerCnt < p.indicatorCnt ? "subtle" : ""}`}>
          {p.answerCnt}/{p.indicatorCnt}
        </span>
      ),
      sortValue: (p) => p.answerCnt / Math.max(1, p.indicatorCnt),
    },
    {
      key: "status",
      header: "상태",
      width: 96,
      render: (p) => <StatusChip status={p.status} />,
      sortValue: (p) => STATUSES.indexOf(p.status),
    },
    { key: "seal", header: "합의", width: 92, render: (p) => <AgreementSeal ax={p.axAgree} hx={p.hxAgree} /> },
    {
      key: "upd",
      header: "수정",
      width: 84,
      render: (p) => (
        <span className="subtle" title={fmtDateTime(p.updAt)}>
          {fmtRelative(p.updAt)}
        </span>
      ),
      sortValue: (p) => p.updAt,
    },
  ];

  async function exportXlsx() {
    try {
      await download(`/api/export/projects${query ? `?${query}` : ""}`, "PoC_과제목록.xlsx");
    } catch (e) {
      toastError(errMessage(e));
    }
  }

  async function bulk(action: "status" | "confirm", to?: ProjectStatus, note?: string) {
    try {
      const r = await api<{ prjId: string; ok: boolean; message?: string }[]>("/api/projects/bulk", {
        body: { action, ids: Array.from(selected), to, note },
      });
      const okN = r.filter((x) => x.ok).length;
      const fails = r.filter((x) => !x.ok);
      if (okN) toast(`${okN}건 처리했습니다.`);
      if (fails.length) toastError(`${fails.length}건 실패 — ${fails[0].prjId}: ${fails[0].message}`);
      setSelected(new Set());
      await reload();
    } catch (e) {
      toastError(errMessage(e));
    }
  }

  const isAdmin = me?.role === "AX_ADMIN";

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="과제 포트폴리오"
        description="PoC 후보 과제 전체입니다. 지표 프로필은 18개 지표의 응답 수준을 영역별로 보여주며, 큰 칸이 Major 지표입니다."
        actions={
          <>
            {me && can(me, "export") && (
              <Button icon="download" onClick={exportXlsx}>
                엑셀 내려받기
              </Button>
            )}
            {me && can(me, "project.create") && (
              <Button variant="primary" icon="plus" onClick={() => router.push("/entry/new")}>
                과제 등록
              </Button>
            )}
          </>
        }
      />

      <Panel flush>
        <div className={s.filters}>
          <form
            className={s.search}
            onSubmit={(e) => {
              e.preventDefault();
              setParam("q", q.trim());
            }}
          >
            <Icon name="search" size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="과제명·시스템·PM·코드 검색" aria-label="검색" />
          </form>
          <FilterSelect label="상태" value={sp.get("status") ?? ""} onChange={(v) => setParam("status", v)}>
            {STATUSES.map((x) => (
              <option key={x} value={x}>
                {STATUS_LABEL[x]}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="적합도" value={sp.get("fit") ?? ""} onChange={(v) => setParam("fit", v)}>
            {FITS.map((x) => (
              <option key={x} value={x}>
                {FIT_LABEL[x]}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="과제 영역" value={sp.get("devType") ?? ""} onChange={(v) => setParam("devType", v)}>
            {codes?.workAreas.map((x) => (
              <option key={x.code} value={x.code}>
                {x.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="배포 형식" value={sp.get("sysType") ?? ""} onChange={(v) => setParam("sysType", v)}>
            {codes?.sysTypes.map((x) => (
              <option key={x.code} value={x.code}>
                {x.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="언어" value={sp.get("lang") ?? ""} onChange={(v) => setParam("lang", v)}>
            {codes?.langs.map((x) => (
              <option key={x.code} value={x.code}>
                {x.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="담당" value={sp.get("domain") ?? ""} onChange={(v) => setParam("domain", v)}>
            {codes?.domains.map((x) => (
              <option key={x.code} value={x.code}>
                {x.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="PM" value={sp.get("pm") ?? ""} onChange={(v) => setParam("pm", v)}>
            {pms?.map((x) => (
              <option key={x.userId} value={x.userId}>
                {x.userNm}
              </option>
            ))}
          </FilterSelect>
          {activeFilters > 0 && (
            <button className={s.reset} onClick={() => (setQ(""), router.replace(pathname))}>
              필터 초기화
            </button>
          )}
        </div>
        <div className={s.summary}>
          <span>
            <b className="num">{rows.length}</b>건
          </span>
          <span className={s.dist}>
            {(["H", "M", "L", "NA"] as const).map((f) => (
              <span key={f} className={s.distItem} data-fit={f}>
                {FIT_LABEL[f]} <b className="num">{dist[f]}</b>
              </span>
            ))}
          </span>
          <span className={s.legend}>
            <span className={s.legendSolid} /> 확정
            <span className={s.legendDash} /> 참고 등급
          </span>
        </div>
        {error && (
          <div style={{ padding: 16 }}>
            <Callout tone="danger">{error}</Callout>
          </div>
        )}
        {loading && !data ? (
          <div style={{ padding: 20, display: "grid", gap: 12 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} h={40} />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(p) => p.prjId}
            onRowClick={(p) => router.push(`/projects/${p.prjId}`)}
            selectable={isAdmin}
            selected={selected}
            onSelectedChange={setSelected}
            initialSort={{ key: "prjId", dir: "asc" }}
            empty={
              <EmptyState title={activeFilters ? "조건에 맞는 과제가 없습니다" : "등록된 과제가 없습니다"}>
                {activeFilters ? "필터를 조정해 보세요." : "과제 PM 이 후보 과제를 등록하면 이곳에 나타납니다."}
              </EmptyState>
            }
          />
        )}
      </Panel>

      {isAdmin && selected.size > 0 && (
        <BulkBar count={selected.size} onClear={() => setSelected(new Set())} onStatus={(to, note) => bulk("status", to, note)} onConfirm={() => bulk("confirm")} />
      )}
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={`${s.filter} ${value ? s.filterOn : ""}`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{label} 전체</option>
        {children}
      </select>
    </label>
  );
}
