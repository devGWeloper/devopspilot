"use client";

import { useState, type KeyboardEvent } from "react";
import { fromMin, readTime, toMin } from "@/lib/measure/spans";
import s from "./effort.module.css";

const STEP = 10;
// 저장 형식이 23:59 까지라 10분 단위 마지막 칸은 23:50
const LAST = 24 * 60 - STEP;

/**
 * 시각 직접 쓰기 "HH:MM" — 930·0930·9:30 처럼 적어도 되고 ↑↓ 는 10분씩.
 * 잘못 쓴 값도 그대로 올려 보내 입력 창이 저장을 막게 한다 — 이전 값으로 몰래 되돌리면 적은 줄 알고 넘어간다.
 */
export function TimeText({
  value,
  onChange,
  label,
  invalid,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  function commit() {
    if (draft === null) return;
    onChange(readTime(draft, STEP) ?? draft);
    setDraft(null);
  }
  function key(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") return e.currentTarget.blur();
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const cur = toMin(readTime(draft ?? value, 1) ?? "");
    if (Number.isNaN(cur)) return;
    const next = fromMin(Math.max(0, Math.min(LAST, e.key === "ArrowUp" ? Math.floor(cur / STEP) * STEP + STEP : Math.ceil(cur / STEP) * STEP - STEP)));
    setDraft(next);
    onChange(next);
  }
  return (
    <input
      className={`${s.timeText} ${invalid ? s.timeBad : ""}`}
      value={draft ?? value}
      onFocus={(e) => {
        setDraft(value);
        e.target.select();
      }}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d:]/g, ""))}
      onBlur={commit}
      onKeyDown={key}
      inputMode="numeric"
      maxLength={5}
      placeholder="09:00"
      autoFocus={autoFocus}
      aria-label={`${label} 시각`}
      aria-invalid={invalid || undefined}
      title="10분 단위 — 0930 처럼 숫자만 적어도 됩니다. ↑↓ 로 10분씩"
    />
  );
}

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
