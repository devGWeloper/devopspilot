// 직접 입력 시간대 — 서버 검증과 입력 창 경고가 같은 규칙을 쓰도록 한곳에 둔다.
import type { ActType } from "./types";

export interface EffortSpan {
  type: ActType;
  /** "HH:MM" (KST) */
  start: string;
  end: string;
}

export interface Interval {
  start: string;
  end: string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isHHMM = (v: unknown): v is string => typeof v === "string" && HHMM.test(v);

/** "13:40" → 820. 형식이 틀리면 NaN */
export function toMin(t: string): number {
  if (!isHHMM(t)) return NaN;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fromMin(m: number): string {
  const v = Math.max(0, Math.min(24 * 60 - 1, Math.round(m)));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

/** 구간 길이(분). 끝이 시작보다 빠르면 0 */
export const spanMin = (s: Interval) => Math.max(0, toMin(s.end) - toMin(s.start));

/** 끝과 시작이 맞닿는 것은 겹침이 아니다 (13:00~14:00 다음 14:00~15:00) */
export const overlaps = (a: Interval, b: Interval) => toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);

/** 겹친 길이(분) */
export const overlapMin = (a: Interval, b: Interval) => Math.max(0, Math.min(toMin(a.end), toMin(b.end)) - Math.max(toMin(a.start), toMin(b.start)));

/** 손으로 적은 시각 → "HH:MM". 930·0930·9:30·9 를 모두 받고, step 분 단위가 아니거나 시각이 아니면 null */
export function readTime(text: string, step = 10): string | null {
  const t = text.trim();
  const c = /^(\d{1,2}):(\d{1,2})$/.exec(t);
  let h: number;
  let m: number;
  if (c) [h, m] = [Number(c[1]), Number(c[2])];
  else if (/^\d{1,4}$/.test(t)) [h, m] = t.length <= 2 ? [Number(t), 0] : [Number(t.slice(0, -2)), Number(t.slice(-2))];
  else return null;
  if (h > 23 || m > 59 || m % step) return null;
  return fromMin(h * 60 + m);
}

/** from~to 안에서 taken 이 차지하지 않은 시간. 입력 단위(step 분)에 맞춰 안쪽으로 자르고, step 보다 짧은 틈은 버린다 */
export function freeGaps(taken: Interval[], from: string, to: string, step = 10): Interval[] {
  const hi = toMin(to);
  const xs = taken.map((t) => [toMin(t.start), toMin(t.end)] as const).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  const push = (a: number, b: number) => {
    const s = Math.ceil(a / step) * step;
    const e = Math.floor(b / step) * step;
    if (e - s >= step) out.push({ start: fromMin(s), end: fromMin(e) });
  };
  let cur = toMin(from);
  for (const [a, b] of xs) {
    if (cur >= hi) break;
    push(cur, Math.min(a, hi));
    cur = Math.max(cur, b);
  }
  if (cur < hi) push(cur, hi);
  return out;
}
