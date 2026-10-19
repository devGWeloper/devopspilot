"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Checkbox, Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, KpiTile, Panel } from "@/components/ui/Panel";
import { Segmented, Tabs } from "@/components/ui/Tabs";
import { f1, man, pct } from "@/lib/format";
import type { Agg, Ratio } from "@/lib/measure/metrics";
import { ACT_TYPES } from "@/lib/measure/types";
import { STAGE_LABEL } from "@/lib/types";
import type { DashFilter, DashVM } from "@/lib/views";
import { Button } from "@/components/ui/Button";
import { STATUS_LABEL } from "../common/bits";
import { ByDimPanel } from "./ByDimPanel";
import { StageMatrix } from "./StageMatrix";
import d from "./dashboard.module.css";

type View = "stage" | "project" | "req";
type Row = {
  key: string;
  label: ReactNode;
  sub?: ReactNode;
  a: Agg;
  indent?: boolean;
  onClick?: () => void;
};

function AggTable({ rows, total }: { rows: Row[]; total: Agg }) {
  const cells = (a: Agg) => (
    <>
      <td className={d.r}>{f1(a.baseMd)}</td>
      <td className={d.r}>{f1(a.inT)}</td>
      <td className={d.r}>{f1(a.out)}</td>
      <td className={d.r}>{f1(a.md)}</td>
      <td className={d.r}>{f1(a.saveMd)}</td>
      <td className={d.r}>
        <b>{pct(a.save, 1)}</b>
      </td>
      <td className={d.r}>{pct(a.use)}</td>
      <td className={d.r}>{man(a.baseCost)}</td>
      <td className={d.r}>{man(a.labor)}</td>
      <td className={d.r}>
        {man(a.aiCost)}
        {a.aiNa > 0 && <span className={d.sub}> 빈칸 {a.aiNa}</span>}
      </td>
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
            <th className={d.r}>AI 사용 h</th>
            <th className={d.r}>AI 없이 h</th>
            <th className={d.r}>투입 M/D</th>
            <th className={d.r}>절감 M/D</th>
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
            <tr
              key={r.key}
              className={[
                r.indent ? d.indent : "",
                r.onClick ? d.click : "",
              ].join(" ")}
              onClick={r.onClick}
            >
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

const ratioSub = (r: Ratio) => (r.den ? `확정 ${r.num} / 대상 ${r.den} (사번·일자)` : "마감이 지난 기록 없음");

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
  const toggle = (id: string) =>
    setOpen((x) =>
      x.has(id)
        ? new Set(Array.from(x).filter((y) => y !== id))
        : new Set([...Array.from(x), id]),
    );
  const A = vm.total;

  const query = (f: DashFilter) => {
    const q = new URLSearchParams();
    if (f.prjId) q.set("prj", f.prjId);
    if (f.includeIng) q.set("ing", "1");
    return q.size ? `?${q}` : "";
  };

  function go(patch: Partial<DashFilter>) {
    const n = { ...vm.filter, ...patch };
    const q = new URLSearchParams();
    if (n.prjId) q.set("prj", n.prjId);
    if (n.includeIng) q.set("ing", "1");
    start(() =>
      router.push(`${path}${q.size ? `?${q}` : ""}`, { scroll: false }),
    );
  }

  const rows: Row[] =
    view === "stage"
      ? vm.stages.flatMap((s) => [
          {
            key: s.cd,
            label: <b>{STAGE_LABEL[s.cd]}</b>,
            sub: `${s.agg.unitN}건`,
            a: s.agg,
          },
          ...(s.workTypes.length > 1
            ? s.workTypes.map((w) => ({
                key: `${s.cd}-${w.workType}`,
                label: w.workType,
                a: w.agg,
                indent: true,
              }))
            : []),
        ])
      : view === "project"
        ? vm.projects.flatMap((p) => [
            {
              key: p.prjId,
              label: (
                <b>
                  <span className={d.caret}>
                    {open.has(p.prjId) ? "▾" : "▸"}
                  </span>
                  {p.prjNm}
                </b>
              ),
              sub: `측정 완료 ${p.doneN}/${p.reqN} · 눌러서 요구사항 보기`,
              a: p.agg,
              onClick: () => toggle(p.prjId),
            },
            ...(open.has(p.prjId)
              ? vm.reqs
                  .filter((r) => r.prjId === p.prjId)
                  .map((r) => ({
                    key: r.rk,
                    label: r.rk,
                    sub: `${r.name && r.name !== r.reqId ? `${r.name} · ` : ""}${STATUS_LABEL[r.status]}`,
                    a: r.agg,
                    indent: true,
                  }))
              : []),
          ])
        : vm.reqs.map((r) => ({
            key: r.rk,
            label: <b>{r.rk}</b>,
            sub: `${r.name && r.name !== r.reqId ? `${r.name} · ` : ""}${r.prjNm} · ${STATUS_LABEL[r.status]}`,
            a: r.agg,
          }));

  const types = ACT_TYPES.map((t) => ({ t, h: A.byType[t.cd] ?? 0 })).filter(
    (x) => x.h > 0,
  );

  return (
    <div style={{ opacity: pending ? 0.6 : 1, transition: "opacity 120ms" }}>
      <PageHeader
        eyebrow="Phase 2 결과"
        title="측정 결과"
        description={`${scopeNote} · 개발자가 확정한 공수만 계산합니다. 기준은 요구사항·단계별 기준 공수(M/D), 산식은 기준 데이터 > 05 집계 로직입니다.`}
        actions={
          <Button icon="file" onClick={() => router.push(`/dashboard/basis${query(vm.filter)}`)}>
            산출 근거 보기
          </Button>
        }
      >
        <div className={d.filters}>
          <Select
            value={vm.filter.prjId}
            onChange={(e) => go({ prjId: e.target.value })}
            aria-label="과제"
            style={{ maxWidth: 260 }}
          >
            <option value="">과제 전체</option>
            {vm.projectOptions.map((p) => (
              <option key={p.prjId} value={p.prjId}>
                {p.prjId} {p.prjNm}
              </option>
            ))}
          </Select>
          <Checkbox
            label="측정 중인 요구사항도 포함"
            checked={vm.filter.includeIng}
            onChange={(e) => go({ includeIng: e.target.checked })}
          />
        </div>
      </PageHeader>

      {A.reqN === 0 ? (
        <Panel>
          <EmptyState title="아직 집계할 요구사항이 없습니다">
            측정 완료로 지정된 요구사항이 없습니다. &apos;측정 중인 요구사항도
            포함&apos;을 켜면 진행 중 값을 볼 수 있습니다.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className={d.kpiHead}>주요 · 집계 대상 요구사항 {A.reqN}건 · 단계 {A.unitN}개 · 확정 공수 {f1(A.tot)}h</div>
          <div className={d.kpi}>
            <KpiTile
              label="투입 공수 절감률"
              value={pct(A.save, 1)}
              sub={`기준 ${f1(A.baseMd)} → 실제 ${f1(A.md)} M/D`}
            />
            <KpiTile
              label="절감 공수"
              value={f1(A.saveMd)}
              unit="M/D"
              sub={`= ${f1(A.saveMd * vm.settings.mdHours * 60)}분 ÷ ${vm.settings.mdHours * 60}`}
            />
            <KpiTile
              label="비용 순절감률"
              value={pct(A.net, 1)}
              sub={`기준 ${man(A.baseCost)} → 인건비 ${man(A.labor)} + AI ${man(A.aiCost)} 만원`}
            />
            <KpiTile
              label="비용 순절감액"
              value={man(A.netAmt)}
              unit="만원"
              sub={A.aiNa > 0 ? `AI 비용 빈칸 ${A.aiNa}건 (토큰 단가 미입력) — 0 으로 더함` : "기준 인건비 − 실제 인건비 − AI 비용"}
            />
          </div>
          <div className={d.kpiHead}>보조 · 활용 / 관리</div>
          <div className={d.kpi}>
            <KpiTile
              label="AI 활용률"
              value={pct(A.use)}
              sub={`AI 내 ${f1(A.inT)}h / 실제 ${f1(A.tot)}h`}
            />
            <KpiTile
              label="AI 밖 비중"
              value={pct(A.outShare)}
              sub={`AI 밖 ${f1(A.out)}h / 실제 ${f1(A.tot)}h`}
            />
            <KpiTile
              label="태그 입력률"
              value={pct(vm.tag.rate)}
              sub={`태그로 배정 ${f1(vm.tag.num / 60)}h / 수집 ${f1(vm.tag.den / 60)}h`}
            />
            <KpiTile
              label="다음 날 확정률"
              value={pct(vm.nextDay.rate)}
              sub={ratioSub(vm.nextDay)}
            />
          </div>

          <Panel flush style={{ marginTop: 20 }}>
            <div style={{ padding: "4px 20px 0" }}>
              <Tabs<View>
                value={view}
                onChange={setView}
                items={[
                  {
                    key: "project",
                    label: "과제별",
                    count: vm.projects.length,
                  },
                  { key: "stage", label: "SDLC 단계별" },
                  { key: "req", label: "요구사항별", count: vm.reqs.length },
                ]}
              />
            </div>
            <AggTable rows={rows} total={A} />
          </Panel>

          {canCompare && <StageMatrix vm={vm} />}

          <ByDimPanel vm={vm} />

          <Panel title="AI 없이 한 일 — 작업 유형별" style={{ marginTop: 20 }}>
            {types.length === 0 ? (
              <p className="muted">입력된 시간이 없습니다.</p>
            ) : (
              <div className={d.types}>
                {types.map(({ t, h }) => (
                  <div key={t.cd} className={d.kv}>
                    <span>{t.label}</span>
                    <b>
                      {f1(h)}h{" "}
                      <span className="subtle">
                        {pct(A.out ? h / A.out : null)}
                      </span>
                    </b>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className={d.sub} style={{ marginTop: 12 }}>
            {vm.metrics.map((m) => (
              <div key={m.key}>
                <b>{m.name}</b> = {m.formula}
              </div>
            ))}
            <div style={{ marginTop: 4 }}>
              1 M/D = {vm.settings.mdHours}h · 금액 단위 만원 · 태그 입력률·다음 날 확정률은 범위 안 담당자 기준 · 단가는 기준 데이터 &gt; 04 기준정보
            </div>
          </div>
        </>
      )}
    </div>
  );
}
