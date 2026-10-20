import type { ReactNode } from "react";
import s from "./stats.module.css";

/** 화면 맨 위 숫자 띠 — 묶음마다 한 테두리 안에 칸을 나눠 둔다 */
export function Stats({ children }: { children: ReactNode }) {
  return <div className={s.stats}>{children}</div>;
}

export function StatGroup({ children }: { children: ReactNode }) {
  return <div className={s.group}>{children}</div>;
}

/** tone 은 0이 아닐 때만 넘긴다 — 색은 위험 신호에만 */
export function Stat({ label, value, unit, tone }: { label: string; value: ReactNode; unit?: string; tone?: "warn" | "danger" }) {
  return (
    <div className={`${s.stat} ${tone ? s[tone] : ""}`}>
      <span className={s.label}>{label}</span>
      <span className={s.value}>
        {value}
        {unit && <small>{unit}</small>}
      </span>
    </div>
  );
}
