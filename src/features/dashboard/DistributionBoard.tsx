"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/Tabs";
import { dimensions, distribute, type DistSummary } from "@/lib/distribution";
import type { Codes, Criteria, Project, ProjectStatus } from "@/lib/types";
import s from "./distribution.module.css";

type Basis = "selected" | "withReserve";

const BASIS: Record<Basis, ProjectStatus[]> = { selected: ["SELECTED"], withReserve: ["SELECTED", "RESERVE"] };

// 한 분류에 선정의 절반 넘게 몰리면 그 분류의 생산성 효과가 전체 결론을 끌고 가므로 쏠림으로 본다.
const SKEW_SHARE = 0.5;

export function DistributionBoard({ projects, criteria, codes }: { projects: Project[]; criteria: Criteria; codes: Codes }) {
  const [basis, setBasis] = useState<Basis>("selected");
  const sums = dimensions(codes).map((d) => distribute(projects, d, BASIS[basis]));
  const chosenTotal = projects.filter((p) => BASIS[basis].includes(p.status)).length;
  const candTotal = projects.filter((p) => p.status !== "EXCLUDED").length;
  const fullyCovered = sums.filter((x) => x.available > 0 && x.covered === x.available).length;

  return (
    <div className={s.wrap}>
      <div className={s.toolbar}>
        <Segmented
          ariaLabel="집계 기준"
          value={basis}
          onChange={setBasis}
          options={[
            { key: "selected", label: "선정 기준" },
            { key: "withReserve", label: "선정 + 예비" },
          ]}
        />
        <span className={s.summary}>
          후보 <b className="num">{candTotal}</b>건 중 {basis === "selected" ? "선정" : "선정·예비"} <b className="num">{chosenTotal}</b>건 · 6개 분류 축 중{" "}
          <b className="num">{fullyCovered}</b>개 축에서 후보가 있는 모든 분류를 포함
        </span>
        <span className={s.legend}>
          <span className={s.lgChosen} /> 선정
          <span className={s.lgCand} /> 후보
          <span className={s.lgGap}>공백</span> 후보는 있으나 선정 없음
        </span>
      </div>

      <div className={s.coverage}>
        {sums.map((x) => (
          <CoverageTile key={x.dim.key} sum={x} />
        ))}
      </div>

      <div className={s.grid}>
        {sums.map((x) => (
          <DimBars key={x.dim.key} sum={x} projects={projects} />
        ))}
      </div>
    </div>
  );
}

function CoverageTile({ sum }: { sum: DistSummary }) {
  const skew = sum.topShare > SKEW_SHARE && sum.covered > 0 && sum.available > 1;
  return (
    <div className={s.tile}>
      <span className="eyebrow">{sum.dim.title}</span>
      <div className={s.tileValue}>
        <b className="num">{sum.covered}</b>
        <span className="subtle">/ {sum.available} 분류</span>
      </div>
      <div className={s.pills} aria-hidden>
        {sum.rows
          .filter((r) => r.candidates > 0)
          .map((r) => (
            <span key={r.code} className={r.chosen > 0 ? s.pillOn : s.pillGap} title={`${r.label}: 선정 ${r.chosen} / 후보 ${r.candidates}`} />
          ))}
      </div>
      <div className={s.tileNote}>
        {sum.gaps.length > 0 ? (
          <span className={s.gapText}>공백 {sum.gaps.join(", ")}</span>
        ) : sum.available > 0 ? (
          <span className="subtle">후보 분류 모두 포함</span>
        ) : (
          <span className="subtle">후보 없음</span>
        )}
        {skew && (
          <span className={s.skew}>
            {sum.topLabel} 쏠림 {Math.round(sum.topShare * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}

function DimBars({ sum, projects }: { sum: DistSummary; projects: Project[] }) {
  const rows = sum.rows.filter((r) => r.candidates > 0);
  const empty = sum.rows.length - rows.length;
  const max = Math.max(1, ...rows.map((r) => r.candidates));
  const nameOf = (id: string) => projects.find((p) => p.prjId === id)?.prjNm ?? id;
  return (
    <div className={s.dim}>
      <div className={s.dimHead}>
        <b>{sum.dim.title}</b>
        {empty > 0 && <span className="subtle">후보 없는 분류 {empty}개 생략</span>}
      </div>
      {rows.length === 0 && <p className="subtle" style={{ fontSize: 12 }}>집계할 후보가 없습니다.</p>}
      <ul className={s.bars}>
        {rows.map((r) => (
          <li key={r.code} className={s.bar} title={r.chosenIds.length ? r.chosenIds.map(nameOf).join("\n") : "선정 과제 없음"}>
            <span className={s.barLabel}>{r.label}</span>
            <span className={s.track}>
              <span className={s.cand} style={{ width: `${(r.candidates / max) * 100}%` }} />
              <span className={s.chosen} style={{ width: `${(r.chosen / max) * 100}%` }} />
            </span>
            <span className={s.barNum}>
              {r.chosen > 0 ? <b className="num">{r.chosen}</b> : <span className={s.gapText}>0</span>}
              <span className="subtle num">/{r.candidates}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
