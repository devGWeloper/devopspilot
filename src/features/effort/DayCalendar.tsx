"use client";

import { useState } from "react";
import { hm } from "@/lib/format";
import type { EffortDayVM } from "@/lib/views";
import s from "./calendar.module.css";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

const ym = (d: string) => d.slice(0, 7);
const shift = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** 달력 한 장 — 할 일이 남은 날은 배지로, 누르면 그 날 공수가 열린다 */
export function DayCalendar({ days, date, today, onPick }: { days: EffortDayVM[]; date: string; today: string; onPick: (d: string) => void }) {
  const [month, setMonth] = useState(ym(date));
  // 다른 곳(KPI 타일)에서 날짜를 바꾸면 그 달로 따라간다.
  const [seen, setSeen] = useState(date);
  if (seen !== date) {
    setSeen(date);
    setMonth(ym(date));
  }
  const byDate = new Map(days.map((d) => [d.date, d]));
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array<null>(first).fill(null), ...Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const todoIn = (mo: string) => days.filter((d) => ym(d.date) === mo && (d.need > 0 || d.pending > 0)).length;
  const prevTodo = days.some((d) => ym(d.date) < month && (d.need > 0 || d.pending > 0));

  return (
    <div className={s.cal}>
      <div className={s.head}>
        <button type="button" className={s.nav} onClick={() => setMonth(shift(month, -1))} aria-label="이전 달">
          ‹{prevTodo && <i className={s.navDot} title="이전 달에 할 일이 남아 있습니다" />}
        </button>
        <b>
          {y}년 {m}월
        </b>
        <button type="button" className={s.nav} onClick={() => setMonth(shift(month, 1))} disabled={month >= ym(today)} aria-label="다음 달">
          ›
        </button>
      </div>
      <div className={s.grid}>
        {DOW.map((w, i) => (
          <span key={w} className={`${s.dow} ${i === 0 || i === 6 ? s.weekend : ""}`}>
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} />;
          const v = byDate.get(d);
          const future = d > today;
          const done = !!v && v.need === 0 && Object.keys(v.st).length > 0;
          const tip = [
            v?.need ? `확정 필요 ${v.need}건` : "",
            v?.pending ? `미분류 Codex 세션 ${v.pending}건` : "",
            v?.tot ? `투입 ${hm(v.tot)}` : "",
            done ? "확정됨" : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <button
              key={d}
              type="button"
              disabled={future}
              className={`${s.day} ${d === date ? s.on : ""} ${d === today ? s.today : ""}`}
              onClick={() => onPick(d)}
              title={tip || undefined}
              aria-label={`${d}${tip ? ` ${tip}` : ""}`}
              aria-pressed={d === date}
            >
              <span className={s.num}>{Number(d.slice(8))}</span>
              <span className={s.badges}>
                {!!v?.need && <span className={s.need}>확정</span>}
                {!!v?.pending && <span className={s.pend}>{v.pending}</span>}
                {done && <span className={s.done}>✓</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className={s.legend}>
        <span>
          <span className={s.need}>확정</span> 확정 필요
        </span>
        <span>
          <span className={s.pend}>2</span> 미분류 Codex 세션
        </span>
        <span>
          <span className={s.done}>✓</span> 확정됨
        </span>
      </div>
      {todoIn(month) === 0 && days.some((d) => d.need > 0 || d.pending > 0) && <p className={s.note}>이 달에는 할 일이 없습니다. 위 &apos;확정할 날&apos; 숫자를 누르면 남은 날로 갑니다.</p>}
    </div>
  );
}
