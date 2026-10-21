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
