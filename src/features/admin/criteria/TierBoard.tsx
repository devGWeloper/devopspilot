"use client";

import { FIT_COLOR } from "@/lib/labels";
import type { Criteria, Tier } from "@/lib/types";
import s from "./criteria.module.css";

// 컨설턴트와 회의하며 지표를 Major/Minor 로 빠르게 나누는 화면. 선택지 편집은 '지표·선택지 편집' 보기에서 한다.
export function TierBoard({ criteria, onChange }: { criteria: Criteria; onChange: (c: Criteria) => void }) {
  function setTier(areaIdx: number, indIdx: number, tier: Tier) {
    const next: Criteria = JSON.parse(JSON.stringify(criteria));
    next.areas[areaIdx].indicators[indIdx].tier = tier;
    onChange(next);
  }

  return (
    <div className={s.tierBoard}>
      <div className={s.tierHead}>
        <span>영역 · 지표</span>
        <span>선택지 → 수준</span>
        <span style={{ textAlign: "center" }}>구분</span>
      </div>
      {criteria.areas.map((a, ai) => (
        <div key={a.id} className={s.tierArea}>
          <div className={s.tierAreaName}>
            <span className="eyebrow">0{ai + 1}</span>
            <b>{a.name}</b>
            <span className="subtle">{a.question}</span>
          </div>
          {a.indicators.map((ind, ii) => (
            <div key={ind.id} className={`${s.tierRow} ${ind.tier === "MAJOR" ? s.tierRowMajor : ""}`}>
              <div>
                <div className={s.tierName}>{ind.name}</div>
                <div className="subtle" style={{ fontSize: 12 }}>
                  {ind.description}
                </div>
              </div>
              <div className={s.optPills}>
                {ind.options.map((o) => (
                  <span key={o.id} className={s.optPill}>
                    <span className={s.optDot} style={{ background: FIT_COLOR[o.level] }} />
                    {o.label}
                  </span>
                ))}
              </div>
              <div className={s.tierToggle} role="radiogroup" aria-label={`${ind.name} 구분`}>
                {(["MAJOR", "MINOR"] as const).map((t) => (
                  <button key={t} role="radio" aria-checked={ind.tier === t} className={s.tierBtn} data-tier={t} onClick={() => setTier(ai, ii, t)}>
                    {t === "MAJOR" ? "Major" : "Minor"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
