"use client";

import { FitBadge } from "@/components/ui/FitBadge";
import type { Criteria, FitRule } from "@/lib/types";
import s from "./criteria.module.css";

function NumIn({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <input
      type="number"
      min={0}
      step={1}
      className={s.ruleNum}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
    />
  );
}

export function RuleEditor({ criteria, onChange }: { criteria: Criteria; onChange: (c: Criteria) => void }) {
  const r = criteria.rule;
  const set = (patch: Partial<FitRule>) => onChange({ ...criteria, rule: { ...r, ...patch } });
  const majors = criteria.areas.flatMap((a) => a.indicators).filter((i) => i.tier === "MAJOR").length;
  const half = Math.floor(majors / 2) + 1;

  return (
    <div className={s.rules}>
      <div className={s.rule}>
        <FitBadge fit="L" size="sm" />
        <p>
          Major 지표 중 <b>하</b>가 <NumIn value={r.lowMinMajorLow} onChange={(n) => set({ lowMinMajorLow: n })} label="하 판정 기준 개수" />개
          이상
        </p>
      </div>
      <div className={s.rule}>
        <FitBadge fit="H" size="sm" />
        <p>
          Major 지표 중 <b>하</b>가 <NumIn value={r.highMaxMajorLow} onChange={(n) => set({ highMaxMajorLow: n })} label="상 허용 하 개수" />개 이하이고,{" "}
          <b>상</b>이{" "}
          <select
            className={s.ruleSel}
            value={r.highMinMajorHigh === "half" ? "half" : "n"}
            onChange={(e) => set({ highMinMajorHigh: e.target.value === "half" ? "half" : half })}
            aria-label="상 기준 방식"
          >
            <option value="half">과반({half}개)</option>
            <option value="n">직접 지정</option>
          </select>
          {r.highMinMajorHigh !== "half" && (
            <>
              {" "}
              <NumIn value={r.highMinMajorHigh} onChange={(n) => set({ highMinMajorHigh: n })} label="상 기준 개수" />개
            </>
          )}{" "}
          이상
        </p>
      </div>
      <div className={s.rule}>
        <FitBadge fit="M" size="sm" />
        <p>그 외</p>
      </div>
      <p className={s.ruleNote}>
        Major {majors}개 기준. Major 를 하나라도 응답하지 않으면 미평가입니다. Minor 지표는 판정을 바꾸지 않고 과제 화면에 보완 신호로만 표시됩니다.
      </p>
    </div>
  );
}
