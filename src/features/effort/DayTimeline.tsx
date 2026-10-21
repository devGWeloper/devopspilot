"use client";

import { hm } from "@/lib/format";
import { fromMin, overlapMin, toMin, type Interval } from "@/lib/measure/spans";
import s from "./timeline.module.css";

export type BarKind = "codex" | "direct" | "pending" | "off";

export interface Bar extends Interval {
  key: string;
  kind: BarKind;
  /** 막대 안 글자 · 툴팁 */
  label: string;
  /** 활동 시간(분) — Codex 세션은 시작~끝 사이에 실제로 쓴 시간이 더 짧을 수 있다 */
  min?: number;
}

export interface Lane {
  key: string;
  label: string;
  sub?: string;
  bars: Bar[];
}

const KIND_LABEL: Record<BarKind, string> = {
  codex: "Codex 사용",
  direct: "직접 입력",
  pending: "미분류 Codex",
  off: "업무 외",
};

const STEP = 30;

/**
 * 축은 출근 시각에서 시작해 날마다 같은 자리에서 읽히게 하고, 끝은 그날 마지막 PoC 일까지만 그린다.
 * 직접 입력이 Codex 사용과 겹친 곳은 같은 시간이 두 번 잡힌 것이라 빨갛게 표시한다.
 */
export function DayTimeline({ lanes, work, untimed = 0 }: { lanes: Lane[]; work: Interval; untimed?: number }) {
  const all = lanes.flatMap((l) => l.bars).filter((b) => toMin(b.end) > toMin(b.start));
  if (!all.length) return null;
  const first = Math.min(...all.map((b) => toMin(b.start)));
  const last = Math.max(...all.map((b) => toMin(b.end)));
  const lo = Math.floor(Math.min(first, toMin(work.start)) / STEP) * STEP;
  const hi = Math.max(lo + 60, Math.ceil(last / STEP) * STEP);
  const span = hi - lo;
  const every = span > 6 * 60 ? 60 : STEP;
  const ticks = Array.from({ length: Math.floor(span / every) + 1 }, (_, i) => lo + i * every);
  const x = (m: number) => `${((m - lo) / span) * 100}%`;
  const w = (a: Interval) => `${((toMin(a.end) - toMin(a.start)) / span) * 100}%`;

  const codex = all.filter((b) => b.kind === "codex");
  const clashes = all
    .filter((b) => b.kind === "direct")
    .flatMap((d) =>
      codex
        .filter((c) => overlapMin(d, c) > 0)
        .map((c) => ({ start: fromMin(Math.max(toMin(d.start), toMin(c.start))), end: fromMin(Math.min(toMin(d.end), toMin(c.end))), d, c })),
    );
  const clashMin = clashes.reduce((a, c) => a + toMin(c.end) - toMin(c.start), 0);
  const kinds = (Object.keys(KIND_LABEL) as BarKind[]).filter((k) => all.some((b) => b.kind === k));
  const done = all.filter((b) => b.kind === "codex" || b.kind === "direct");
  // 조기 출근·야근도 받는다 — 근무시간 밖은 막지 않고 그늘로만 보인다.
  const ws = toMin(work.start);
  const we = toMin(work.end);
  const outside = [
    ...(lo < ws ? [{ start: fromMin(lo), end: fromMin(Math.min(ws, hi)) }] : []),
    ...(hi > we ? [{ start: fromMin(Math.max(we, lo)), end: fromMin(hi) }] : []),
  ].filter((o) => toMin(o.end) > toMin(o.start));
  const outMin = done.reduce((a, b) => a + outside.reduce((m, o) => m + overlapMin(b, o), 0), 0);

  return (
    <section className={s.tl} aria-label="이 날 작업 흐름" data-tour="dayFlow">
      <header className={s.head}>
        <b>이 날 작업 흐름</b>
        <span className="subtle">
          {/* 시간대 없는 예전 값은 그릴 자리가 없지만 합계는 표와 같아야 한다 */}
          {fromMin(first)} ~ {fromMin(last)} · PoC 작업 {hm(done.reduce((a, b) => a + (b.min ?? toMin(b.end) - toMin(b.start)), 0) / 60 + untimed)}
          {outMin > 0 && ` · 근무시간(${work.start}~${work.end}) 외 ${hm(outMin / 60)}`}
        </span>
        <span className={s.legend}>
          {kinds.map((k) => (
            <span key={k}>
              <i className={`${s.key} ${s[k]}`} />
              {KIND_LABEL[k]}
            </span>
          ))}
          {clashes.length > 0 && (
            <span>
              <i className={`${s.key} ${s.clashKey}`} />
              겹침
            </span>
          )}
          {outside.length > 0 && (
            <span>
              <i className={`${s.key} ${s.outKey}`} />
              근무시간 외
            </span>
          )}
        </span>
      </header>

      <div className={s.grid}>
        <span />
        <div className={s.axis}>
          {ticks.map((t) => (
            <span key={t} style={{ left: x(t) }}>
              {fromMin(t)}
            </span>
          ))}
        </div>
        {lanes
          .filter((l) => l.bars.length)
          .map((l) => (
            <Row key={l.key} l={l} ticks={ticks} x={x} w={w} clashes={clashes} outside={outside} />
          ))}
      </div>

      {clashes.length > 0 && (
        <p className={s.warn}>
          직접 입력과 Codex 사용이 {hm(clashMin / 60)} 겹칩니다 ({clashes.map((c) => `${c.start}~${c.end}`).join(", ")}) — 같은 시간이 두 번 잡혔습니다. 그 시간에 Codex 를 쓰지 않았다면 Codex 칸의 &apos;시간 빼기&apos;로, 아니면 직접 입력 시간대를 고쳐 주세요.
        </p>
      )}
    </section>
  );
}

function Row({
  l,
  ticks,
  x,
  w,
  clashes,
  outside,
}: {
  l: Lane;
  ticks: number[];
  x: (m: number) => string;
  w: (a: Interval) => string;
  clashes: { start: string; end: string; d: Bar; c: Bar }[];
  outside: Interval[];
}) {
  const mine = clashes.filter((c) => l.bars.includes(c.d) || l.bars.includes(c.c));
  return (
    <>
      <span className={s.lane} title={l.sub ? `${l.label} · ${l.sub}` : l.label}>
        {l.label}
        {l.sub && <small>{l.sub}</small>}
      </span>
      <div className={s.track}>
        {outside.map((o) => (
          <i key={o.start} className={s.out} style={{ left: x(toMin(o.start)), width: w(o) }} title={`근무시간 외 ${o.start}~${o.end}`} />
        ))}
        {ticks.map((t) => (
          <i key={t} className={s.tick} style={{ left: x(t) }} />
        ))}
        {l.bars.map((b) => (
          <span
            key={b.key}
            className={`${s.bar} ${s[b.kind]}`}
            style={{ left: x(toMin(b.start)), width: w(b) }}
            title={`${KIND_LABEL[b.kind]} · ${b.label}\n${b.start}~${b.end}${b.min !== undefined ? ` · 활동 ${hm(b.min / 60)}` : ` · ${hm((toMin(b.end) - toMin(b.start)) / 60)}`}`}
          >
            <span>{b.label}</span>
          </span>
        ))}
        {mine.map((c, i) => (
          <span key={i} className={s.clash} style={{ left: x(toMin(c.start)), width: w(c) }} title={`겹침 ${c.start}~${c.end}`} />
        ))}
      </div>
    </>
  );
}
