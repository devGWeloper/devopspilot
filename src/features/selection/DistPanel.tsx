"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Field";
import { f1 } from "@/lib/format";
import { DIMS, catsOf, type DimKey } from "@/lib/dims";
import type { SelectionVM } from "@/lib/views";
import { SHADES } from "./shades";
import s from "./selection.module.css";

const REQ_DIMS = DIMS.filter((d) => d.level === "req");

/** 과제마다 요구사항 성격이 고르게 섞였는지 — 한쪽으로 몰리면 그 과제의 절감률이 그 성격의 결과가 된다. */
export function DistPanel({ vm }: { vm: SelectionVM }) {
  const [axis, setAxis] = useState<DimKey>("fit");
  const dim = REQ_DIMS.find((d) => d.key === axis) ?? REQ_DIMS[0];
  const of = (v: string) => v || "미입력";
  const cols = catsOf(dim, vm.reqs.map((r) => r.dims[axis])).concat(vm.reqs.some((r) => !r.dims[axis]) ? ["미입력"] : []);
  const total = (c: string) => vm.reqs.filter((r) => of(r.dims[axis]) === c).length;

  return (
    <Panel
      flush
      title="과제별 분포"
      actions={
        <Select value={axis} onChange={(e) => setAxis(e.target.value as DimKey)} aria-label="분류 기준" style={{ minWidth: 160 }}>
          {REQ_DIMS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.title}
            </option>
          ))}
        </Select>
      }
    >
      <p className={s.note}>요구사항 수 기준입니다. 칸에 마우스를 올리면 요구사항 이름이 보이고, 전체에서 0 인 수준은 빨간색으로 표시합니다.</p>
      <div className={s.scroll}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>과제</th>
              {cols.map((c) => (
                <th key={c} className={s.c}>
                  {c}
                </th>
              ))}
              <th className={s.c}>합계</th>
              <th style={{ width: "24%" }}>구성</th>
              <th className={s.r}>기준 M/D</th>
            </tr>
          </thead>
          <tbody>
            {vm.projects.map((p) => {
              const rs = vm.reqs.filter((r) => r.prjId === p.prjId);
              return (
                <tr key={p.prjId}>
                  <td>
                    <b>{p.prjNm}</b> <span className="subtle">{p.kind}</span>
                  </td>
                  {cols.map((c) => {
                    const hit = rs.filter((r) => of(r.dims[axis]) === c);
                    return (
                      <td key={c} className={`${s.c} ${hit.length ? s.cnt : s.zero}`} title={hit.map((r) => `${r.reqId} ${r.name}`).join("\n")}>
                        {hit.length || "·"}
                      </td>
                    );
                  })}
                  <td className={s.c}>
                    <b>{rs.length}</b>
                  </td>
                  <td>
                    <Bar parts={cols.map((c) => rs.filter((r) => of(r.dims[axis]) === c).length)} />
                  </td>
                  <td className={s.r}>{f1(p.baseMd)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>전체</td>
              {cols.map((c) => (
                <td key={c} className={`${s.c} ${total(c) || c === "미입력" ? "" : s.gap}`}>
                  {total(c)}
                  <span className={s.share}>{vm.reqs.length ? Math.round((total(c) / vm.reqs.length) * 100) : 0}%</span>
                </td>
              ))}
              <td className={s.c}>{vm.reqs.length}</td>
              <td>
                <Bar parts={cols.map(total)} />
              </td>
              <td className={s.r}>{f1(vm.projects.reduce((a, p) => a + p.baseMd, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

export function Bar({ parts }: { parts: number[] }) {
  const sum = parts.reduce((a, b) => a + b, 0);
  return (
    <div className={s.bar}>
      {parts.map((v, i) => (v ? <i key={i} style={{ width: `${(v / sum) * 100}%`, background: SHADES[i] ?? SHADES[SHADES.length - 1] }} /> : null))}
    </div>
  );
}
