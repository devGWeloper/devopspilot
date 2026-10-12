"use client";

import Link from "next/link";
import { useState } from "react";
import { Segmented } from "@/components/ui/Tabs";
import { effectiveFit } from "@/lib/balance";
import { FIT_LABEL } from "@/lib/labels";
import { dimensions, type DimKey } from "@/lib/distribution";
import { LEVELS, type Codes, type Project } from "@/lib/types";
import s from "./dashboard.module.css";

export function BalanceMatrix({ projects, codes, compact }: { projects: Project[]; codes: Codes; compact?: boolean }) {
  const dims = dimensions(codes).filter((d) => d.key !== "fit");
  const [axis, setAxis] = useState<DimKey>("devType");
  const dim = dims.find((d) => d.key === axis) ?? dims[0];
  const cols = dim.cats.map((c) => ({ key: c.code, label: c.label }));
  const keyOf = dim.of;

  const pool = projects.filter((p) => p.status !== "EXCLUDED" && effectiveFit(p) !== "NA");

  return (
    <div>
      {!compact && (
        <div className={`${s.matrixBar} no-print`}>
          <Segmented
            ariaLabel="열 기준"
            value={axis}
            onChange={setAxis}
            options={dims.map((d) => ({ key: d.key, label: d.title }))}
          />
          <span className={s.matrixLegend}>
            <span className={s.chipSel}>선정</span>
            <span className={s.chipCand}>후보</span>
            <span className={s.gapSample} /> 선정 공백
          </span>
        </div>
      )}
      <div className={s.matrixScroll}>
        <table className={s.matrix}>
          <thead>
            <tr>
              <th aria-label="적합도" />
              {cols.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((lv) => (
              <tr key={lv}>
                <th className={s.rowHead}>
                  <span className={s.rowBadge}>
                    {FIT_LABEL[lv]}
                  </span>
                </th>
                {cols.map((c) => {
                  const cell = pool.filter((p) => effectiveFit(p) === lv && keyOf(p) === c.key);
                  const selected = cell.filter((p) => p.status === "SELECTED");
                  const gap = selected.length === 0;
                  return (
                    <td key={c.key} className={`${s.cell} ${gap ? s.cellGap : ""}`}>
                      <div className={s.cellInner}>
                        {cell
                          .sort((a, b) => (a.status === "SELECTED" ? -1 : 0) - (b.status === "SELECTED" ? -1 : 0))
                          .map((p) => (
                            <Link
                              key={p.prjId}
                              href={`/projects/${p.prjId}`}
                              className={p.status === "SELECTED" ? s.chipSel : s.chipCand}
                              title={`${p.prjId} ${p.prjNm}`}
                            >
                              {p.prjNm}
                            </Link>
                          ))}
                        {gap && cell.length === 0 && <span className={s.gapLabel}>공백</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
