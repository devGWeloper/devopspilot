"use client";

import { Fragment, useState } from "react";
import { Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, KpiTile, Panel } from "@/components/ui/Panel";
import { f1 } from "@/lib/format";
import { DIMS, DIM_BY_KEY, catsOf, type Dim, type DimKey } from "@/lib/dims";
import type { SelReqVM, SelectionVM } from "@/lib/views";
import { STATUS_LABEL } from "../common/bits";
import { Bar, DistPanel } from "./DistPanel";
import { SHADES } from "./shades";
import s from "./selection.module.css";

// 한 분류에 절반 넘게 몰리면 그 분류의 효과가 전체 결론을 끌고 가므로 쏠림으로 본다.
const SKEW = 0.5;
// 균형 점검을 하는 축 — 나머지는 참고용 분포
const CHECK: DimKey[] = ["fit", "difficulty", "grade", "stage", "kind", "area", "deployType"];
const LEVELS = ["상", "중", "하"];

interface Count {
  cat: string;
  n: number;
  ids: string[];
}

function countDim(vm: SelectionVM, d: Dim): { rows: Count[]; total: number; blank: number } {
  if (d.level === "prj") {
    const val = (p: SelectionVM["projects"][number]) =>
      d.key === "kind" ? p.kind : d.key === "area" ? p.area : d.key === "deployType" ? p.deployType : d.key === "dept" ? p.deptCd : p.sysGrade;
    const cats = catsOf(d, vm.projects.map(val));
    return {
      rows: cats.map((cat) => {
        const ps = vm.projects.filter((p) => val(p) === cat);
        return { cat, n: ps.length, ids: ps.map((p) => p.prjNm) };
      }),
      total: vm.projects.length,
      blank: vm.projects.filter((p) => !val(p)).length,
    };
  }
  const cats = catsOf(d, vm.reqs.map((r) => r.dims[d.key]));
  return {
    rows: cats.map((cat) => {
      const rs = vm.reqs.filter((r) => r.dims[d.key] === cat);
      return { cat, n: rs.length, ids: rs.map((r) => `${r.reqId} ${r.name}`) };
    }),
    total: vm.reqs.length,
    blank: vm.reqs.filter((r) => !r.dims[d.key]).length,
  };
}

function warningsOf(vm: SelectionVM): string[] {
  const out: string[] = [];
  for (const k of CHECK) {
    const d = DIM_BY_KEY[k];
    const { rows, total, blank } = countDim(vm, d);
    const filled = rows.filter((r) => r.n > 0);
    if (!filled.length) {
      out.push(`${d.title}: 입력된 값이 없습니다.`);
      continue;
    }
    // 양식의 기본 선택값 중 비어 있는 것 — 도구·배포 형식처럼 선택지가 많은 축은 2개 이상 비었을 때만
    const gaps = rows.filter((r) => d.cats.includes(r.cat) && r.n === 0).map((r) => r.cat);
    if (gaps.length && (d.cats.length <= 4 || gaps.length >= d.cats.length - 1)) out.push(`${d.title}: ${gaps.join(", ")} 없음`);
    const top = filled.reduce((a, r) => (r.n > a.n ? r : a));
    const share = top.n / (total - blank || 1);
    if (filled.length > 1 && share > SKEW) out.push(`${d.title}: '${top.cat}' 에 ${Math.round(share * 100)}% 쏠림`);
    if (filled.length === 1 && d.cats.length > 1) out.push(`${d.title}: 모두 '${top.cat}'`);
    if (blank) out.push(`${d.title}: 미입력 ${blank}건`);
  }
  return out;
}

export function SelectionDashboard({ vm }: { vm: SelectionVM }) {
  if (!vm.reqs.length)
    return (
      <>
        <PageHeader eyebrow="Phase 1 결과" title="과제 선정 현황" />
        <Panel>
          <EmptyState title="아직 선정된 과제가 없습니다">관리자가 과제 현황에서 선정 양식을 올리면 분포가 나타납니다.</EmptyState>
        </Panel>
      </>
    );

  const fitN = (lv: string) => vm.reqs.filter((r) => r.dims.fit === lv).length;
  const warns = warningsOf(vm);
  const dev = vm.projects.filter((p) => p.kind === "개발").length;

  return (
    <>
      <PageHeader
        eyebrow="Phase 1 결과"
        title="과제 선정 현황"
        description="선정된 과제와 요구사항이 성격별로 어떻게 퍼져 있는지 봅니다. 생산성 효과가 한쪽 성격에 치우쳐 과대·과소평가되지 않도록 고르게 선정되었는지 확인합니다."
      >
        <div className={s.kpis}>
          <KpiTile label="선정 과제" value={vm.projects.length} unit="건" sub={`개발 ${dev} · 운영 ${vm.projects.length - dev}`} />
          <KpiTile label="요구사항" value={vm.reqs.length} unit="건" sub={`측정 완료 ${vm.reqs.filter((r) => r.status === "DONE").length} · 측정 중 ${vm.reqs.filter((r) => r.status === "ING").length}`} />
          <KpiTile label="예상 기대효과" value={`${fitN("상")} · ${fitN("중")} · ${fitN("하")}`}>
            <Bar parts={LEVELS.map(fitN)} />
            <span className={s.kpiSub}>상 · 중 · 하 (PM 판단, 없으면 참고 등급)</span>
          </KpiTile>
          <KpiTile label="기준 공수" value={f1(vm.reqs.reduce((a, r) => a + r.baseMd, 0))} unit="M/D" sub="AI 미적용 기준 (선정 양식)" />
          <KpiTile label="균형 점검" value={warns.length} unit="건" sub={warns.length ? "아래 목록 확인" : "쏠림·공백 없음"} />
        </div>
      </PageHeader>

      <div className={s.top}>
        <Panel title="분류 축별 분포" flush>
          <div className={s.dims}>
            {DIMS.map((d) => (
              <DimCard key={d.key} d={d} vm={vm} />
            ))}
          </div>
        </Panel>
        <Panel title="균형 점검">
          {warns.length ? (
            <ul className={s.warns}>
              {warns.map((w) => (
                <li key={w}>
                  <Icon name="alert" size={14} /> {w}
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.good}>
              <Icon name="check" size={14} /> 주요 분류 축에서 쏠림·공백이 없습니다.
            </p>
          )}
          <p className={s.note} style={{ padding: "12px 0 0" }}>
            쏠림 = 한 분류가 {Math.round(SKEW * 100)}% 초과 · 공백 = 양식 선택값 중 0건 · 점검 축: {CHECK.map((k) => DIM_BY_KEY[k].title).join(", ")}
          </p>
        </Panel>
      </div>

      <FitMatrix vm={vm} />

      <div style={{ marginTop: 20 }}>
        <DistPanel vm={vm} />
      </div>

      <ReqTable vm={vm} />
    </>
  );
}

function DimCard({ d, vm }: { d: Dim; vm: SelectionVM }) {
  const { rows, total, blank } = countDim(vm, d);
  const shown = rows.filter((r) => r.n > 0 || d.cats.length <= 5);
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className={s.dim}>
      <div className={s.dimHead}>
        <b>{d.title}</b>
        <span className="subtle">
          {d.level === "prj" ? "과제" : "요구사항"} {total}
          {blank ? ` · 미입력 ${blank}` : ""}
        </span>
      </div>
      <ul className={s.bars}>
        {shown.map((r) => (
          <li key={r.cat} title={r.ids.join("\n") || "없음"}>
            <span className={s.barLabel}>{r.cat}</span>
            <span className={s.track}>
              <i style={{ width: `${(r.n / max) * 100}%` }} />
            </span>
            <span className={`${s.barNum} ${r.n ? "" : s.gapTxt}`}>
              {r.n}
              <small>{total ? Math.round((r.n / total) * 100) : 0}%</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MATRIX_AXES: DimKey[] = ["difficulty", "grade", "stage", "kind", "area", "deployType", "dept", "sysGrade", "tool"];

/** 기대효과 상·중·하 × 과제 성격 — 칸마다 어떤 요구사항이 들어갔는지 */
function FitMatrix({ vm }: { vm: SelectionVM }) {
  const [axis, setAxis] = useState<DimKey>("difficulty");
  const d = DIM_BY_KEY[axis];
  const cols = catsOf(d, vm.reqs.map((r) => r.dims[axis])).filter((c) => vm.reqs.some((r) => r.dims[axis] === c) || d.cats.length <= 5);
  const rows = [...LEVELS, ...(vm.reqs.some((r) => !r.dims.fit) ? [""] : [])];
  const prjNm = new Map(vm.projects.map((p) => [p.prjId, p.prjNm]));
  return (
    <Panel
      title="예상 기대효과 × 과제 성격"
      style={{ marginTop: 20 }}
      flush
      actions={
        <Select value={axis} onChange={(e) => setAxis(e.target.value as DimKey)} aria-label="열 기준" style={{ minWidth: 160 }}>
          {MATRIX_AXES.map((k) => (
            <option key={k} value={k}>
              열: {DIM_BY_KEY[k].title}
            </option>
          ))}
        </Select>
      }
    >
      <p className={s.note}>칸 안은 요구사항입니다. 비어 있는 칸은 그 조합의 표본이 없다는 뜻입니다 — 측정 결과에서 그 성격은 비교할 수 없습니다.</p>
      <div className={s.scroll}>
        <table className={`${s.table} ${s.matrix}`}>
          <thead>
            <tr>
              <th style={{ width: 90 }}>기대효과</th>
              {cols.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((lv, i) => (
              <tr key={lv || "none"}>
                <th className={s.rowHead}>
                  <span className={s.lv} style={{ background: SHADES[i] ?? SHADES[4], color: i < 2 ? "#fff" : "var(--ink)" }}>
                    {lv || "미입력"}
                  </span>
                </th>
                {cols.map((c) => {
                  const rs = vm.reqs.filter((r) => r.dims.fit === lv && r.dims[axis] === c);
                  return (
                    <td key={c} className={rs.length ? "" : s.empty}>
                      {rs.map((r) => (
                        <span key={r.reqId} className={s.chip} title={`${prjNm.get(r.prjId)} · ${r.reqId} · ${STATUS_LABEL[r.status]}`}>
                          {r.name}
                        </span>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

const IND: [DimKey, string][] = [
  ["difficulty", "난이도"],
  ["grade", "등급"],
  ["spec", "명세"],
  ["ctx", "맥락"],
  ["gen", "생성"],
  ["fit", "기대효과"],
  ["tool", "AI 도구"],
];

/** 선택값 순서(유리 → 불리)로 진하기를 정한다 */
function Val({ k, v }: { k: DimKey; v: string }) {
  if (!v) return <span className="subtle">—</span>;
  const i = DIM_BY_KEY[k].cats.indexOf(v);
  const tone = k === "tool" || k === "grade" || i < 0 ? s.v0 : [s.v1, s.v2, s.v3][i] ?? s.v0;
  return <span className={`${s.val} ${tone}`}>{v}</span>;
}

function ReqTable({ vm }: { vm: SelectionVM }) {
  return (
    <Panel title="요구사항 × 지표 한눈에 보기" flush style={{ marginTop: 20 }}>
      <div className={s.scroll}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>요구사항</th>
              {IND.map(([k, l]) => (
                <th key={k}>{l}</th>
              ))}
              <th>참고 등급</th>
              <th className={s.r}>기준 M/D</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {vm.projects.map((p) => (
              <Fragment key={p.prjId}>
                <tr className={s.prj}>
                  <td colSpan={IND.length + 4}>
                    {p.prjNm} <span className="subtle">· {[p.kind, p.area, p.deployType, p.sysGrade].filter(Boolean).join(" · ")}</span>
                  </td>
                </tr>
                {vm.reqs
                  .filter((r) => r.prjId === p.prjId)
                  .map((r: SelReqVM) => (
                    <tr key={r.reqId}>
                      <td>
                        <b>{r.name}</b>
                        <div className="subtle" style={{ fontSize: 12 }}>
                          {r.reqId} · {r.dims.stage}
                        </div>
                      </td>
                      {IND.map(([k]) => (
                        <td key={k}>
                          <Val k={k} v={r.dims[k]} />
                        </td>
                      ))}
                      <td className="subtle">{r.fitRef || "—"}</td>
                      <td className={s.r}>{f1(r.baseMd)}</td>
                      <td>{STATUS_LABEL[r.status]}</td>
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
