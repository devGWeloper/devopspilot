"use client";

import { Fragment, memo, useState } from "react";
import { Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { FORM_GROUPS, tally } from "@/lib/projects/form";
import type { SelectionVM } from "@/lib/views";
import { AXES, AXIS_BY_ID, BLANK, type Axis, type AxisDist } from "./axes";
import s from "./selection.module.css";

type Filters = Record<string, string>;

// 많을수록 진하게 — 색 대신 명도만 써서 업무 화면 무채색 원칙을 지킨다.
const shade = (r: number) => ({ background: `rgba(15, 23, 42, ${(0.08 + r * 0.77).toFixed(2)})`, color: r > 0.45 ? "#fff" : "var(--ink)" });
// 선택값 순서(상→하, L0→L4)대로 진하기를 내려서 막대 하나만 봐도 어느 쪽에 몰렸는지 읽힌다.
const rank = (i: number, len: number) => {
  const a = len > 1 ? 0.85 - (i / (len - 1)) * 0.7 : 0.6;
  return { background: `rgba(15, 23, 42, ${a.toFixed(2)})`, color: a > 0.45 ? "#fff" : "var(--ink)" };
};

/** 그룹별 열에 항목마다 막대 하나 — 검색어 입력마다 다시 그리지 않도록 memo. */
export const DistPanel = memo(function DistPanel({ dists, filters, onPick }: { dists: Map<string, AxisDist>; filters: Filters; onPick: (id: string, v: string) => void }) {
  return (
    <Panel flush title="성격별 분포">
      <div className={s.sumGrid}>
        {FORM_GROUPS.map((g) => {
          const axes = AXES.filter((a) => a.group === g.key);
          if (!axes.length) return null;
          const n = dists.get(axes[0].id)?.total ?? 0;
          return (
            <section key={g.key} className={s.sumCol}>
              <h3 className={s.sumHead}>
                {g.title}
                <span>
                  {axes[0].level === "prj" ? "과제" : "요구사항"} {n}건
                </span>
              </h3>
              {axes.map((a) => (
                <StackBar key={a.id} a={a} dist={dists.get(a.id)!} picked={filters[a.id]} onPick={(v) => onPick(a.id, v)} />
              ))}
            </section>
          );
        })}
      </div>
    </Panel>
  );
});

export const CrossPanel = memo(function CrossPanel({ vm, onPick }: { vm: SelectionVM; onPick: (pairs: [string, string][]) => void }) {
  return (
    <Panel title="교차 분포" style={{ marginTop: 20 }}>
      <CrossView vm={vm} onPick={onPick} />
    </Panel>
  );
});

function StackBar({ a, dist, picked, onPick }: { a: Axis; dist: AxisDist; picked?: string; onPick: (v: string) => void }) {
  const { rows, total, blank, warns } = dist;
  const filled = rows.map((r, i) => ({ ...r, i })).filter((r) => r.n > 0);
  return (
    <div className={s.sb}>
      <div className={s.sbHead}>
        <span className={s.sbLabel}>{a.label}</span>
        {warns.length > 0 && (
          <span className={s.sbWarn} title={warns.join("\n")}>
            <Icon name="alert" size={12} />
            {warns[0]}
            {warns.length > 1 && ` 외 ${warns.length - 1}`}
          </span>
        )}
      </div>
      <div className={s.sbBar}>
        {filled.map((r) => {
          const share = r.n / (total || 1);
          return (
            <button key={r.v} type="button" className={`${s.sbSeg} ${picked === r.v ? s.sbPicked : ""}`} style={{ flexGrow: r.n, ...rank(r.i, a.options.length) }} onClick={() => onPick(r.v)} title={`${r.v} ${r.n}건 (${Math.round(share * 100)}%) — 표에서 보기`}>
              {/* 좁으면 이름부터 줄어들고 숫자는 남는다 */}
              <span className={s.sbV}>{r.v}</span>
              <b>{r.n}</b>
            </button>
          );
        })}
        {blank > 0 && (
          <button type="button" className={`${s.sbSeg} ${s.sbBlank} ${picked === BLANK ? s.sbPicked : ""}`} style={{ flexGrow: blank }} onClick={() => onPick(BLANK)} title={`미입력 ${blank}건 — 표에서 보기`}>
            <span className={s.sbV}>미입력</span>
            <b>{blank}</b>
          </button>
        )}
      </div>
    </div>
  );
}

const ROWS = ["PRJ-01", ...AXES.filter((a) => a.level === "req").map((a) => a.id)];

/** 두 항목을 겹쳐 본다 — 비어 있는 칸은 그 조합의 표본이 없어 측정 결과에서 비교할 수 없다는 뜻. */
function CrossView({ vm, onPick }: { vm: SelectionVM; onPick: (pairs: [string, string][]) => void }) {
  const [rowId, setRowId] = useState("FIT-06");
  const [colId, setColId] = useState("REQ-04");
  const col = AXIS_BY_ID[colId];
  const isPrj = rowId === "PRJ-01";
  const rowGet = isPrj ? (r: SelectionVM["reqs"][number]) => r.values["PRJ-01"] ?? "" : AXIS_BY_ID[rowId].get;
  const rowCats = isPrj ? vm.projects.map((p) => p.prjNm) : tally(AXIS_BY_ID[rowId].options, vm.reqs.map(rowGet)).map((x) => x.v);
  const colCats = tally(col.options, vm.reqs.map(col.get)).filter((x) => x.n > 0 || col.options.length <= 6).map((x) => x.v);
  const blankRow = !isPrj && vm.reqs.some((r) => !rowGet(r));
  const blankCol = vm.reqs.some((r) => !col.get(r));
  const rows = [...rowCats, ...(blankRow ? [""] : [])];
  const cols = [...colCats, ...(blankCol ? [""] : [])];
  // 칸마다 전체 행을 다시 세지 않도록 한 번에 센다.
  const cell = new Map<string, number>();
  const rowN = new Map<string, number>();
  const colN = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const r of vm.reqs) {
    bump(cell, JSON.stringify([rowGet(r), col.get(r)]));
    bump(rowN, rowGet(r));
    bump(colN, col.get(r));
  }
  const n = (rv: string, cv: string) => cell.get(JSON.stringify([rv, cv])) ?? 0;
  const total = vm.reqs.length || 1;
  const maxCell = Math.max(1, ...Array.from(cell.values()));
  const maxRow = Math.max(1, ...rows.map((rv) => rowN.get(rv) ?? 0));
  const maxCol = Math.max(1, ...cols.map((cv) => colN.get(cv) ?? 0));
  const rowLabel = isPrj ? "과제" : AXIS_BY_ID[rowId].label;

  return (
    <div>
      <div className={s.crossPick}>
        <Select value={rowId} onChange={(e) => setRowId(e.target.value)} aria-label="세로 축" className={s.filter}>
          {ROWS.map((id) => (
            <option key={id} value={id}>
              {id === "PRJ-01" ? "과제" : AXIS_BY_ID[id].label}
            </option>
          ))}
        </Select>
        <span className="subtle">×</span>
        <Select value={colId} onChange={(e) => setColId(e.target.value)} aria-label="가로 축" className={s.filter}>
          {AXES.filter((a) => a.id !== rowId).map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
      </div>
      <div className={s.scroll}>
        {/* 축 이름 · 행 값 · 칸들 · 행 합계 — 가장자리 막대로 어느 줄·열이 비었는지 격자 밖에서도 보인다 */}
        <div className={s.mx} style={{ gridTemplateColumns: `24px max-content repeat(${cols.length}, minmax(76px, 132px)) 96px` }}>
          <span className={s.mxY} style={{ gridRow: `1 / span ${rows.length}` }}>
            {rowLabel}
          </span>
          {rows.map((rv) => {
            const sum = rowN.get(rv) ?? 0;
            return (
              <Fragment key={rv || "blank"}>
                <span className={s.mxRow} title={rv || "미입력"}>
                  {rv || "미입력"}
                </span>
                {cols.map((cv) => {
                  const k = n(rv, cv);
                  return k ? (
                    <button key={cv || "blank"} type="button" className={s.mxCell} style={shade(k / maxCell)} onClick={() => onPick([[rowId, rv || BLANK], [colId, cv || BLANK]])} title={`${rv || "미입력"} × ${cv || "미입력"} ${k}건 — 표에서 보기`}>
                      <b>{k}</b>
                      <small>{Math.round((k / total) * 100)}%</small>
                    </button>
                  ) : (
                    <span key={cv || "blank"} className={s.mxEmpty} title={`${rv || "미입력"} × ${cv || "미입력"} 없음`} />
                  );
                })}
                <span className={s.mxMargin}>
                  <i style={{ width: `${(sum / maxRow) * 100}%` }} />
                  {sum}
                </span>
              </Fragment>
            );
          })}
          <span />
          <span />
          {cols.map((cv) => (
            <span key={cv || "blank"} className={s.mxColFoot}>
              <span className={s.mxColBar}>
                <i style={{ width: `${((colN.get(cv) ?? 0) / maxCol) * 100}%` }} />
              </span>
              <span className={s.mxCol}>
                {cv || "미입력"} <b>{colN.get(cv) ?? 0}</b>
              </span>
            </span>
          ))}
          <span />
          <span />
          <span />
          <span className={s.mxX} style={{ gridColumn: `3 / span ${cols.length}` }}>
            {col.label}
          </span>
        </div>
      </div>
    </div>
  );
}
