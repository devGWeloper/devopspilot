"use client";

import s from "./effort.module.css";

const STEP = 10;

/** 시 · 분(10분 단위) 고르기. 값은 분 */
export function DurationInput({
  min,
  onChange,
  maxMin = 16 * 60,
  label,
  autoFocus,
}: {
  min: number;
  onChange: (min: number) => void;
  maxMin?: number;
  label: string;
  autoFocus?: boolean;
}) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hs = Array.from({ length: Math.floor(maxMin / 60) + 1 }, (_, i) => i);
  // 이전 0.1시간 단위로 넣은 값(예: 18분)도 그대로 보이고 다시 저장할 수 있게 선택지에 남긴다.
  const ms = Array.from(new Set([...Array.from({ length: 60 / STEP }, (_, i) => i * STEP), m])).sort((a, b) => a - b);
  const set = (nh: number, nm: number) => onChange(Math.min(maxMin, nh * 60 + nm));
  return (
    <span className={s.dur}>
      <select value={h} onChange={(e) => set(Number(e.target.value), m)} aria-label={`${label} 시간`} autoFocus={autoFocus}>
        {hs.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      시간
      <select value={m} onChange={(e) => set(h, Number(e.target.value))} aria-label={`${label} 분`}>
        {ms.map((x) => (
          <option key={x} value={x}>
            {String(x).padStart(2, "0")}
          </option>
        ))}
      </select>
      분
    </span>
  );
}

/** 시각 고르기 "HH:MM" — 분은 10분 단위 */
export function TimeInput({ value, onChange, label, invalid }: { value: string; onChange: (v: string) => void; label: string; invalid?: boolean }) {
  const [h, m] = value.split(":").map(Number);
  const ms = Array.from(new Set([...Array.from({ length: 60 / STEP }, (_, i) => i * STEP), m])).sort((a, b) => a - b);
  const pad = (x: number) => String(x).padStart(2, "0");
  return (
    <span className={`${s.dur} ${invalid ? s.durBad : ""}`}>
      <select value={h} onChange={(e) => onChange(`${pad(Number(e.target.value))}:${pad(m)}`)} aria-label={`${label} 시`}>
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {pad(i)}
          </option>
        ))}
      </select>
      :
      <select value={m} onChange={(e) => onChange(`${pad(h)}:${pad(Number(e.target.value))}`)} aria-label={`${label} 분`}>
        {ms.map((x) => (
          <option key={x} value={x}>
            {pad(x)}
          </option>
        ))}
      </select>
    </span>
  );
}
