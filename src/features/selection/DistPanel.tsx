"use client";

import { memo, useState } from "react";
import { Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Tabs";
import { FORM_GROUPS, tally, type FormGroup } from "@/lib/projects/form";
import type { SelectionVM } from "@/lib/views";
import { AXES, AXIS_BY_ID, BLANK, SKEW, type Axis, type AxisDist } from "./axes";
import s from "./selection.module.css";

type Filters = Record<string, string>;

/** 엑셀 그룹별 분포 — 막대를 누르면 아래 표가 그 값으로 걸러진다. 검색어 입력마다 다시 그리지 않도록 memo. */
export const DistPanel = memo(function DistPanel({ dists, filters, onPick }: { dists: Map<string, AxisDist>; filters: Filters; onPick: (id: string, v: string) => void }) {
  const [tab, setTab] = useState<FormGroup>("PRJ");
  const warnN = (g: FormGroup) => AXES.filter((a) => a.group === g).reduce((n, a) => n + (dists.get(a.id)?.warns.length ?? 0), 0);
  return (
    <Panel
      flush
      title="성격별 분포"
      actions={
        <Segmented<FormGroup>
          ariaLabel="양식 그룹"
          value={tab}
          onChange={setTab}
          options={FORM_GROUPS.map((g) => {
            const n = warnN(g.key);
            return { key: g.key, label: n ? <>{g.title} <span className={s.warnN}>{n}</span></> : g.title };
          })}
        />
      }
    >
      <p className={s.note}>
        과제 항목은 과제 수, 나머지는 요구사항(단계) 수로 셉니다. 막대를 누르면 아래 표가 그 값으로 걸러집니다. 점검 표시: 한 값에 {Math.round(SKEW * 100)}% 초과 쏠림 · 선택값 공백 · 미입력.
      </p>
      <div className={s.dims}>
        {AXES.filter((a) => a.group === tab).map((a) => (
          <AxisCard key={a.id} a={a} dist={dists.get(a.id)!} picked={filters[a.id]} onPick={(v) => onPick(a.id, v)} />
        ))}
      </div>
    </Panel>
  );
});

function AxisCard({ a, dist, picked, onPick }: { a: Axis; dist: AxisDist; picked?: string; onPick: (v: string) => void }) {
  const { rows, total, blank, warns } = dist;
  // 선택지가 많은 축은 0건을 접어 둔다 — 업무 유형 15종을 다 그리면 읽히지 않는다.
  const many = rows.length > 8;
  const shown = many ? rows.filter((r) => r.n > 0) : rows;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className={s.dim}>
      <div className={s.dimHead}>
        <b>{a.label}</b>
        <span className="subtle">
          {a.level === "prj" ? "과제" : "요구사항"} {total}
          {blank ? ` · 미입력 ${blank}` : ""}
        </span>
      </div>
      <ul className={s.bars}>
        {shown.map((r) => (
          <li key={r.v}>
            <button type="button" className={`${s.barBtn} ${picked === r.v ? s.picked : ""}`} onClick={() => onPick(r.v)} disabled={!r.n} title={r.n ? `${r.v} — 표에서 보기` : undefined}>
              <span className={s.barLabel}>{r.v}</span>
              <span className={s.track}>
                <i style={{ width: `${(r.n / max) * 100}%` }} />
              </span>
              <span className={`${s.barNum} ${r.n ? "" : s.zeroTxt}`}>
                {r.n}
                <small>{total ? Math.round((r.n / total) * 100) : 0}%</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {many && rows.length > shown.length && <p className={s.folded}>0건 {rows.length - shown.length}종 생략</p>}
      {warns.length > 0 && (
        <ul className={s.warns}>
          {warns.map((w) => (
            <li key={w}>
              <Icon name="alert" size={12} /> {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ROWS = ["PRJ-01", ...AXES.filter((a) => a.level === "req").map((a) => a.id)];

/** 두 항목을 겹쳐 본다 — 비어 있는 칸은 그 조합의 표본이 없어 측정 결과에서 비교할 수 없다는 뜻. */
export const CrossPanel = memo(function CrossPanel({ vm, onPick }: { vm: SelectionVM; onPick: (pairs: [string, string][]) => void }) {
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
  const colTotal = (cv: string) => colN.get(cv) ?? 0;

  return (
    <Panel
      flush
      title="교차 분포"
      style={{ marginTop: 20 }}
      actions={
        <div className={s.crossPick}>
          <Select value={rowId} onChange={(e) => setRowId(e.target.value)} aria-label="행 항목" className={s.filter}>
            {ROWS.map((id) => (
              <option key={id} value={id}>
                행: {id === "PRJ-01" ? "과제" : AXIS_BY_ID[id].label}
              </option>
            ))}
          </Select>
          <span className="subtle">×</span>
          <Select value={colId} onChange={(e) => setColId(e.target.value)} aria-label="열 항목" className={s.filter}>
            {AXES.filter((a) => a.id !== rowId).map((a) => (
              <option key={a.id} value={a.id}>
                열: {a.label}
              </option>
            ))}
          </Select>
        </div>
      }
    >
      <p className={s.note}>요구사항(단계) 수입니다. 칸을 누르면 아래 표가 그 조합으로 걸러지고, 전체에서 0건인 선택값은 빨간색으로 표시합니다.</p>
      <div className={s.scroll}>
        <table className={`${s.table} ${s.cross}`}>
          <thead>
            <tr>
              <th>{isPrj ? "과제" : AXIS_BY_ID[rowId].label}</th>
              {cols.map((c) => (
                <th key={c || "blank"} className={s.c}>
                  {c || "미입력"}
                </th>
              ))}
              <th className={s.c}>합계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((rv) => {
              const sum = rowN.get(rv) ?? 0;
              return (
                <tr key={rv || "blank"}>
                  <td>
                    <b>{rv || "미입력"}</b>
                  </td>
                  {cols.map((cv) => {
                    const k = n(rv, cv);
                    return (
                      <td key={cv || "blank"} className={`${s.c} ${k ? s.cnt : s.zero}`}>
                        {k ? (
                          <button type="button" className={s.cellBtn} onClick={() => onPick([[rowId, rv || BLANK], [colId, cv || BLANK]])}>
                            {k}
                          </button>
                        ) : (
                          "·"
                        )}
                      </td>
                    );
                  })}
                  <td className={s.c}>{sum}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>전체</td>
              {cols.map((cv) => (
                <td key={cv || "blank"} className={`${s.c} ${colTotal(cv) || !cv ? "" : s.gap}`}>
                  {colTotal(cv)}
                  <span className={s.share}>{vm.reqs.length ? Math.round((colTotal(cv) / vm.reqs.length) * 100) : 0}%</span>
                </td>
              ))}
              <td className={s.c}>{vm.reqs.length}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
});
