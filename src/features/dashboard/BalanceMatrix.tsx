"use client";

import Link from "next/link";
import { useState } from "react";
import { Segmented } from "@/components/ui/Tabs";
import { effectiveFit } from "@/lib/balance";
import { FIT_LABEL } from "@/lib/labels";
import { DEV_TYPE_INDICATOR, LEVELS, type Codes, type Criteria, type Project } from "@/lib/types";
import s from "./dashboard.module.css";

type Axis = "devType" | "domain" | "lang" | "sysType";

export function BalanceMatrix({ projects, criteria, codes, compact }: { projects: Project[]; criteria: Criteria; codes: Codes; compact?: boolean }) {
  const [axis, setAxis] = useState<Axis>("devType");
  const devOpts = criteria.areas.flatMap((a) => a.indicators).find((i) => i.id === DEV_TYPE_INDICATOR)?.options ?? [];
  const cols: { key: string; label: string }[] =
    axis === "devType"
      ? devOpts.map((o) => ({ key: o.id, label: o.label }))
      : axis === "domain"
        ? codes.domains.map((c) => ({ key: c.code, label: c.label }))
        : axis === "lang"
          ? codes.langs.map((c) => ({ key: c.code, label: c.label }))
          : codes.sysTypes.map((c) => ({ key: c.code, label: c.label }));
  const keyOf = (p: Project) =>
    axis === "devType" ? p.devTypeCd : axis === "domain" ? p.domainCd : axis === "lang" ? p.mainLangCd : p.sysTypeCd;

  const pool = projects.filter((p) => p.status !== "EXCLUDED" && effectiveFit(p) !== "NA");

  return (
    <div>
      {!compact && (
        <div className={`${s.matrixBar} no-print`}>
          <Segmented
            ariaLabel="열 기준"
            value={axis}
            onChange={setAxis}
            options={[
              { key: "devType", label: "개발 성격" },
              { key: "domain", label: "업무 도메인" },
              { key: "lang", label: "주 언어" },
              { key: "sysType", label: "시스템 유형" },
            ]}
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
