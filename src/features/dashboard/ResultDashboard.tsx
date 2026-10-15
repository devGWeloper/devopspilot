"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Checkbox, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, KpiTile, Panel } from "@/components/ui/Panel";
import { Segmented, Tabs } from "@/components/ui/Tabs";
import { f1, man, pct } from "@/lib/format";
import type { Agg } from "@/lib/measure/metrics";
import { ACT_TYPES } from "@/lib/measure/types";
import { STAGE_LABEL } from "@/lib/types";
import type { DashFilter, DashVM } from "@/lib/views";
import { STATUS_LABEL } from "../common/bits";
import d from "./dashboard.module.css";

type View = "stage" | "project" | "req";
type Row = { key: string; label: ReactNode; sub?: ReactNode; a: Agg; indent?: boolean };

function AggTable({ rows, total }: { rows: Row[]; total: Agg }) {
  const cells = (a: Agg) => (
    <>
      <td className={d.r}>{f1(a.baseMd)}</td>
      <td className={d.r}>{f1(a.md)}</td>
      <td className={d.r}>
        <b>{pct(a.save, 1)}</b>
      </td>
      <td className={d.r}>{pct(a.use)}</td>
      <td className={d.r}>{man(a.baseCost)}</td>
      <td className={d.r}>{man(a.labor)}</td>
      <td className={d.r}>{man(a.aiCost)}</td>
      <td className={d.r}>
        <b>{pct(a.net, 1)}</b>
      </td>
    </>
  );
  return (
    <div style={{ overflowX: "auto" }}>
      <table className={d.table}>
        <thead>
          <tr>
            <th />
            <th className={d.r}>기준 M/D</th>
            <th className={d.r}>투입 M/D</th>
            <th className={d.r}>공수 절감률</th>
            <th className={d.r}>AI 활용률</th>
            <th className={d.r}>기준 인건비</th>
            <th className={d.r}>측정 인건비</th>
            <th className={d.r}>AI 비용</th>
            <th className={d.r}>순절감률</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.indent ? d.indent : undefined}>
              <td>
                {r.label}
                {r.sub && <div className={d.sub}>{r.sub}</div>}
              </td>
              {cells(r.a)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>합계</td>
            {cells(total)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function ResultDashboard({ vm, scopeNote }: { vm: DashVM; scopeNote: string }) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const [view, setView] = useState<View>("stage");
  const A = vm.total;

  function go(patch: Partial<DashFilter>) {
    const n = { ...vm.filter, ...patch };
    if (patch.kind !== undefined) n.prjId = "";
    const q = new URLSearchParams();
    if (n.kind) q.set("kind", n.kind);
    if (n.prjId) q.set("prj", n.prjId);
    if (n.includeIng) q.set("ing", "1");
    start(() => router.push(`${path}${q.size ? `?${q}` : ""}`, { scroll: false }));
  }

  const rows: Row[] =
    view === "stage"
      ? vm.stages.flatMap((s) => [
          { key: s.cd, label: <b>{STAGE_LABEL[s.cd]}</b>, sub: `${s.agg.unitN}건`, a: s.agg },
          ...(s.workTypes.length > 1 ? s.workTypes.map((w) => ({ key: `${s.cd}-${w.workType}`, label: w.workType, a: w.agg, indent: true })) : []),
        ])
      : view === "project"
        ? vm.projects.map((p) => ({ key: p.prjId, label: <b>{p.prjNm}</b>, sub: `${p.kind} · 완료 ${p.doneN}/${p.reqN}`, a: p.agg }))
        : vm.reqs.map((r) => ({ key: r.reqId, label: <b>{r.name}</b>, sub: `${r.reqId} · ${r.prjNm} · ${r.grade} · ${STATUS_LABEL[r.status]}`, a: r.agg }));

  const types = ACT_TYPES.map((t) => ({ t, h: A.byType[t.cd] ?? 0 })).filter((x) => x.h > 0);

  return (
    <div style={{ opacity: pending ? 0.6 : 1, transition: "opacity 120ms" }}>
      <PageHeader eyebrow="Phase 2 결과" title="측정 결과" description={`${scopeNote} · 개발자가 확정한 공수만 계산합니다. 기준은 선정 양식의 기준 공수(M/D)입니다.`}>
        <div className={d.filters}>
          <Segmented
            ariaLabel="구분"
            value={vm.filter.kind || "ALL"}
            onChange={(k) => go({ kind: k === "ALL" ? "" : (k as "개발" | "운영") })}
            options={[
              { key: "ALL", label: "전체" },
              { key: "개발", label: "개발 과제" },
              { key: "운영", label: "운영 과제" },
            ]}
          />
          <Select value={vm.filter.prjId} onChange={(e) => go({ prjId: e.target.value })} aria-label="과제" style={{ maxWidth: 260 }}>
            <option value="">과제 전체</option>
            {vm.projectOptions.map((p) => (
              <option key={p.prjId} value={p.prjId}>
                {p.prjNm}
              </option>
            ))}
          </Select>
          <Checkbox label="측정 중인 요구사항도 포함" checked={vm.filter.includeIng} onChange={(e) => go({ includeIng: e.target.checked })} />
        </div>
      </PageHeader>

      {A.reqN === 0 ? (
        <Panel>
          <EmptyState title="아직 집계할 요구사항이 없습니다">측정 완료로 지정된 요구사항이 없습니다. &apos;측정 중인 요구사항도 포함&apos;을 켜면 진행 중 값을 볼 수 있습니다.</EmptyState>
        </Panel>
      ) : (
        <>
          <div className={d.kpi}>
            <KpiTile label="투입 공수 절감률" value={pct(A.save, 1)} sub={`기준 ${f1(A.baseMd)} → 투입 ${f1(A.md)} M/D`} />
            <KpiTile label="순절감률 (비용)" value={pct(A.net, 1)} sub={`기준 ${man(A.baseCost)} → 인건비 ${man(A.labor)} + AI ${man(A.aiCost)} 만원`} />
            <KpiTile label="AI 활용률" value={pct(A.use)} sub={`AI 사용 ${f1(A.inT)}h / 전체 ${f1(A.tot)}h`} />
            <KpiTile label="집계 대상" value={A.reqN} unit="건" sub={`단계 ${A.unitN}개 · 확정 공수 ${f1(A.tot)}h`} />
          </div>

          <Panel flush style={{ marginTop: 20 }}>
            <div style={{ padding: "4px 20px 0" }}>
              <Tabs<View>
                value={view}
                onChange={setView}
                items={[
                  { key: "stage", label: "단계별" },
                  { key: "project", label: "과제별" },
                  { key: "req", label: "요구사항별", count: vm.reqs.length },
                ]}
              />
            </div>
            <AggTable rows={rows} total={A} />
          </Panel>

          <Panel title="AI 없이 한 일 — 작업 유형별" style={{ marginTop: 20 }}>
            {types.length === 0 ? (
              <p className="muted">입력된 시간이 없습니다.</p>
            ) : (
              <div className={d.types}>
                {types.map(({ t, h }) => (
                  <div key={t.cd} className={d.kv}>
                    <span>{t.label}</span>
                    <b>
                      {f1(h)}h <span className="subtle">{pct(A.out ? h / A.out : null)}</span>
                    </b>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <p className="subtle" style={{ fontSize: 12, marginTop: 12 }}>
            공수 절감률 = (기준 − 투입) ÷ 기준 · 순절감률 = (기준 인건비 − 측정 인건비 − AI 비용) ÷ 기준 인건비 · AI 활용률 = AI 사용 ÷ 전체 투입 · 1 M/D = {vm.settings.mdHours}h · 금액 단위 만원 · 단가는 시스템 관리 &gt; 코드·단가
          </p>
        </>
      )}
    </div>
  );
}
