"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, KpiTile, Panel } from "@/components/ui/Panel";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { download, errMessage } from "@/lib/apiClient";
import { f1, man, pct } from "@/lib/format";
import type { Agg } from "@/lib/measure/metrics";
import { ACT_TYPES } from "@/lib/measure/types";
import { STAGE_LABEL, type StageCd } from "@/lib/types";
import type { DashFilter, DashVM } from "@/lib/views";
import { STATUS_LABEL } from "../common/bits";
import { ByDimPanel } from "./ByDimPanel";
import { CostSaveMatrix } from "./CostSaveMatrix";
import { Bars, ExplainModal, type ExplainKey, type ExplainTarget } from "./Explain";
import x from "./explain.module.css";
import { StageFlow } from "./StageFlow";
import { StageMatrix } from "./StageMatrix";
import { TypeBars } from "./TypeBars";
import d from "./dashboard.module.css";

type View = "stage" | "project" | "req";
type Row = {
  key: string;
  label: ReactNode;
  sub?: ReactNode;
  a: Agg;
  indent?: boolean;
  onClick?: () => void;
  /** 계산 보기 팝업에 넘길 범위·하위 구성 */
  ex: Omit<ExplainTarget, "key" | "a">;
};

/** 절감률 막대 — 0~100% 눈금, 기준보다 더 들면 빨간 점 하나 */
function SaveBar({ v }: { v: number | null }) {
  const neg = v !== null && v < 0;
  return (
    <span className={d.mini}>
      <i className={neg ? d.neg : undefined} style={{ width: neg ? 4 : `${Math.min(1, v ?? 0) * 100}%` }} />
    </span>
  );
}

function AggTable({ rows, total, onExplain }: { rows: Row[]; total: Row; onExplain: (k: ExplainKey, r: Row) => void }) {
  // 과제 줄은 눌러서 펼치므로 퍼센트 클릭이 펼치기로 번지지 않게 막는다.
  const hit = (k: ExplainKey, r: Row, v: string) => (
    <button
      type="button"
      className={x.hit}
      title="계산 보기"
      onClick={(e) => {
        e.stopPropagation();
        onExplain(k, r);
      }}
    >
      {v}
    </button>
  );
  const cells = (r: Row, a = r.a) => (
    <>
      <td className={d.r}>
        {f1(a.baseMd)} <span className="subtle">→</span> <b>{f1(a.md)}</b>
      </td>
      <td>
        <div className={d.saveCell}>
          <SaveBar v={a.save} />
          <b className={a.save !== null && a.save < 0 ? d.low : undefined}>{hit("save", r, pct(a.save, 1))}</b>
        </div>
      </td>
      <td className={d.r}>{hit("net", r, pct(a.net, 1))}</td>
      <td className={d.r}>{hit("use", r, pct(a.use))}</td>
    </>
  );
  return (
    <div style={{ overflowX: "auto" }}>
      <table className={d.table}>
        <thead>
          <tr>
            <th />
            <th className={d.r}>기준 → 실제 공수 (M/D)</th>
            <th className={d.r} style={{ width: "30%" }}>공수 절감률</th>
            <th className={d.r}>비용 순절감률</th>
            <th className={d.r}>AI 활용률</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={[r.indent ? d.indent : "", r.onClick ? d.click : ""].join(" ")} onClick={r.onClick}>
              <td>
                {r.label}
                {r.sub && <div className={d.sub}>{r.sub}</div>}
              </td>
              {cells(r)}
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

export function ResultDashboard({
  vm,
  scopeNote,
  canCompare,
}: {
  vm: DashVM;
  scopeNote: string;
  /** 요구사항 × 단계 기준 대비 표 — 관리자·열람자만 */
  canCompare: boolean;
}) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const [view, setView] = useState<View>("project");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [ex, setEx] = useState<ExplainTarget | null>(null);
  const toggle = (id: string) => setOpen((s) => (s.has(id) ? new Set(Array.from(s).filter((y) => y !== id)) : new Set([...Array.from(s), id])));
  const A = vm.total;
  const H = vm.settings.mdHours;

  const query = (f: DashFilter) => {
    const q = new URLSearchParams();
    if (f.prjId) q.set("prj", f.prjId);
    if (f.includeIng) q.set("ing", "1");
    return q.size ? `?${q}` : "";
  };
  const go = (patch: Partial<DashFilter>) => start(() => router.push(`${path}${query({ ...vm.filter, ...patch })}`, { scroll: false }));
  const { toastError } = useToast();
  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    setExporting(true);
    try {
      await download(`/api/dashboard/export${query(vm.filter)}`, "측정 결과 집계.xlsx");
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setExporting(false);
    }
  };

  type ReqRow = DashVM["reqs"][number];
  const reqName = (r: ReqRow) => (r.name && r.name !== r.reqId ? `${r.rk} ${r.name}` : r.rk);
  const reqEx = (r: ReqRow): Row["ex"] => ({
    scope: reqName(r),
    prjId: r.prjId,
    partsTitle: "SDLC 단계",
    parts: Object.entries(vm.matrix.find((m) => m.rk === r.rk)?.cells ?? {}).flatMap(([cd, c]) => (c?.agg ? [{ key: cd, label: STAGE_LABEL[cd as StageCd], a: c.agg }] : [])),
  });
  const totalRow: Row = {
    key: "total",
    label: "합계",
    a: A,
    ex:
      vm.projects.length > 1
        ? { scope: "전체", partsTitle: "과제", parts: vm.projects.map((p) => ({ key: p.prjId, label: p.prjNm, a: p.agg })) }
        : { scope: vm.projects[0]?.prjNm ?? "전체", prjId: vm.projects[0]?.prjId, partsTitle: "요구사항", parts: vm.reqs.map((r) => ({ key: r.rk, label: reqName(r), a: r.agg })) },
  };
  const explain = (key: ExplainKey, r: Row = totalRow) => setEx({ key, a: r.a, ...r.ex });

  const rows: Row[] =
    view === "stage"
      ? vm.stages.flatMap((s) => [
          {
            key: s.cd,
            label: <b>{STAGE_LABEL[s.cd]}</b>,
            sub: `${s.agg.unitN}건`,
            a: s.agg,
            ex: { scope: `${STAGE_LABEL[s.cd]} 단계`, partsTitle: "업무 유형", parts: s.workTypes.map((w) => ({ key: w.workType, label: w.workType, a: w.agg })) },
          },
          ...(s.workTypes.length > 1
            ? s.workTypes.map((w) => ({
                key: `${s.cd}-${w.workType}`,
                label: w.workType,
                a: w.agg,
                indent: true,
                ex: { scope: `${STAGE_LABEL[s.cd]} · ${w.workType}` },
              }))
            : []),
        ])
      : view === "project"
        ? vm.projects.flatMap((p) => [
            {
              key: p.prjId,
              label: (
                <b>
                  <span className={d.caret}>{open.has(p.prjId) ? "▾" : "▸"}</span>
                  {p.prjNm}
                </b>
              ),
              sub: `요구사항 측정 완료 ${p.doneN}/${p.reqN}`,
              a: p.agg,
              onClick: () => toggle(p.prjId),
              ex: { scope: p.prjNm, prjId: p.prjId, partsTitle: "요구사항", parts: vm.reqs.filter((r) => r.prjId === p.prjId).map((r) => ({ key: r.rk, label: reqName(r), a: r.agg })) },
            },
            ...(open.has(p.prjId)
              ? vm.reqs
                  .filter((r) => r.prjId === p.prjId)
                  .map((r) => ({
                    key: r.rk,
                    label: r.name && r.name !== r.reqId ? r.name : r.rk,
                    sub: `${r.rk} · ${STATUS_LABEL[r.status]}`,
                    a: r.agg,
                    indent: true,
                    ex: reqEx(r),
                  }))
              : []),
          ])
        : vm.reqs.map((r) => ({
            key: r.rk,
            label: <b>{r.name && r.name !== r.reqId ? r.name : r.rk}</b>,
            sub: `${r.rk} · ${r.prjNm} · ${STATUS_LABEL[r.status]}`,
            a: r.agg,
            ex: reqEx(r),
          }));

  const topType = ACT_TYPES.map((t) => ({ t, h: A.byType[t.cd] ?? 0 })).reduce<{ t: (typeof ACT_TYPES)[number]; h: number } | null>((m, x) => (x.h > 0 && (!m || x.h > m.h) ? x : m), null);
  const over = A.save !== null && A.save < 0;

  return (
    <div style={{ opacity: pending ? 0.6 : 1, transition: "opacity 120ms" }}>
      <PageHeader
        title="측정 결과"
        description={`${scopeNote} · 개발자가 확정한 공수로 계산합니다. 숫자를 누르면 계산식이 열립니다.`}
        actions={
          <>
            <Button icon="download" loading={exporting} onClick={exportXlsx}>
              집계 엑셀
            </Button>
            <Button icon="file" onClick={() => router.push(`/dashboard/basis${query(vm.filter)}`)}>
              산출 근거
            </Button>
          </>
        }
      >
        <div className={d.filters}>
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
          <Panel>
            <div className={d.hero}>
              <button type="button" className={d.heroMain} onClick={() => explain("save")}>
                <span className="eyebrow">공수 절감률</span>
                <span className={`${d.heroVal} ${over ? d.low : ""}`}>{pct(A.save, 1)}</span>
                <span className={d.heroLine}>
                  기준 공수 <b>{f1(A.baseMd)} M/D</b> 걸릴 일을 실제 <b>{f1(A.md)} M/D</b> 에 끝냈습니다
                </span>
                <span className={d.heroSub}>
                  {over ? `${f1(-A.saveMd)} M/D 더 들었습니다` : `${f1(A.saveMd)} M/D 절감`} · 요구사항 {A.reqN}건 · 단계 {A.unitN}개
                </span>
                <span className={d.heroLink}>
                  계산식 보기 <Icon name="chevronRight" size={12} />
                </span>
              </button>
              <div className={d.heroBars}>
                <Bars
                  base={A.baseMd}
                  unit=" M/D"
                  fmt={f1}
                  gapLabel="절감"
                  segs={[
                    { label: "AI 사용", v: A.inT / H, tone: "ink" },
                    { label: "AI 없이", v: A.out / H, tone: "mid" },
                  ]}
                />
                <p className={d.heroNote}>1 M/D = {H}시간 · 실제 공수 = 개발자가 확정한 시간 {f1(A.tot)}h</p>
              </div>
            </div>
          </Panel>

          <div className={d.tiles}>
            <KpiTile label="비용 순절감률" value={pct(A.net, 1)} onClick={() => explain("net")} sub={`${man(A.netAmt)}만원 절감 · AI 비용 ${man(A.aiCost)}만원 포함`}>
              {A.aiNa > 0 && <span className={d.sub}>토큰 단가가 없어 AI 비용 0 으로 둔 세션 {A.aiNa}건</span>}
            </KpiTile>
            <KpiTile label="AI 활용률" value={pct(A.use)} onClick={() => explain("use")} sub={`일한 ${f1(A.tot)}h 중 ${f1(A.inT)}h 를 Codex 와 함께`} />
            <KpiTile label="AI 없이 한 시간" value={f1(A.out)} unit="h" onClick={() => explain("use")} sub={topType ? `가장 많은 일: ${topType.t.label} ${f1(topType.h)}h` : "입력 없음"} />
          </div>

          {/* 주요 지표 바로 아래 — AI 를 못 쓴 일이 무엇인지가 개선 방향이라 아래로 내려 두지 않는다 */}
          <Panel title="AI 없이 한 일 — 업무 유형" style={{ marginTop: 12 }} actions={<span className="subtle" style={{ fontSize: 12 }}>AI 없이 {f1(A.out)}h 중 비중 · 과제·요구사항별은 표의 AI 활용률을 누르세요</span>}>
            <TypeBars a={A} />
          </Panel>

          <ExplainModal
            t={ex}
            mdHours={H}
            onKey={(key) => setEx((t) => t && { ...t, key })}
            onClose={() => setEx(null)}
            onBasis={() => router.push(`/dashboard/basis${query({ ...vm.filter, prjId: ex?.prjId ?? vm.filter.prjId })}`)}
          />

          <Panel flush style={{ marginTop: 20 }}>
            <div style={{ padding: "4px 20px 0" }}>
              <Tabs<View>
                value={view}
                onChange={setView}
                items={[
                  { key: "project", label: "과제별", count: vm.projects.length },
                  { key: "stage", label: "SDLC 단계별" },
                  { key: "req", label: "요구사항별", count: vm.reqs.length },
                ]}
              />
            </div>
            <AggTable rows={rows} total={totalRow} onExplain={explain} />
          </Panel>

          <StageFlow vm={vm} />

          <CostSaveMatrix vm={vm} />

          {canCompare && <StageMatrix vm={vm} />}

          <ByDimPanel vm={vm} onExport={exportXlsx} exporting={exporting} />

          <div className={d.quality}>
            <b>데이터 신뢰도</b>
            <span title="Codex 사용 시간 중 브랜치·프롬프트에 적힌 요구사항 코드로 자동 연결된 시간의 비율. 낮으면 사람이 직접 배정한 시간이 많다는 뜻입니다.">
              AI 사용 자동 연결 <b>{pct(vm.tag.rate)}</b> <span className="subtle">({f1(vm.tag.num / 60)}h / {f1(vm.tag.den / 60)}h)</span>
            </span>
            <span title="입력한 날의 다음 영업일 안에 확정한 비율 (사번·일자 기준, 마감 전인 날은 제외)">
              다음 날까지 확정 <b>{pct(vm.nextDay.rate)}</b> <span className="subtle">({vm.nextDay.num} / {vm.nextDay.den}일)</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
