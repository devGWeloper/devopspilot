"use client";

import { f1, pct } from "@/lib/format";
import type { Agg } from "@/lib/measure/metrics";
import { ACT_TYPES } from "@/lib/measure/types";
import d from "./dashboard.module.css";

/** AI 없이 한 시간의 업무 유형 비중 — 어떤 일에 AI 를 못 쓰고 있는지 */
export function TypeBars({ a, empty = "입력된 시간이 없습니다." }: { a: Agg; empty?: string }) {
  const types = ACT_TYPES.map((t) => ({ t, h: a.byType[t.cd] ?? 0 }))
    .filter((t) => t.h > 0)
    .sort((p, q) => q.h - p.h);
  if (!types.length) return <p className="muted">{empty}</p>;
  const max = types[0].h;
  return (
    <div className={d.types}>
      {types.map(({ t, h }) => (
        <div key={t.cd} className={d.typeRow} title={t.desc}>
          <span>{t.label}</span>
          <span className={d.typeTrack}>
            <i style={{ width: `${(h / max) * 100}%` }} />
          </span>
          <b>{f1(h)}h</b>
          <span className="subtle">{pct(h / a.out)}</span>
        </div>
      ))}
    </div>
  );
}
