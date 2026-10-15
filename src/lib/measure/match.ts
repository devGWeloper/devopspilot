import type { AiSession } from "./types";
import type { Unit } from "./units";

export type StoredSession = AiSession & { datId: string };

export interface MatchResult {
  unit: string | null;
  cands: string[];
  why: string;
}

/**
 * 세션을 어느 단계에 붙일지 정한다. 하나로 정해질 때만 자동 배정하고,
 * 애매하면 후보만 돌려준다 — 틀린 자동 배정은 개발자가 알아채기 어렵지만 '확인 필요'는 눈에 보이기 때문.
 */
export function matchSession(s: AiSession, units: Unit[]): MatchResult {
  const hints = new Set(s.hints.map((h) => h.toUpperCase()));
  // 측정 완료 요구사항도 매칭한다 — 완료 전에 쓴 시간이 나중에 올라와도 그 단계에 붙어야 하므로.
  const mine = units.filter((u) => u.ownerId === s.userId);

  const exact = units.filter((u) => hints.has(u.code.toUpperCase()));
  const exactMine = exact.filter((u) => mine.includes(u));
  if (exactMine.length === 1) return { unit: exactMine[0].code, cands: [], why: `코드 ${exactMine[0].code}` };
  if (exactMine.length > 1)
    return { unit: null, cands: exactMine.map((u) => u.code), why: `세션에 단계 코드가 여러 개 (${exactMine.map((u) => u.code).join(", ")})` };

  // 단계 코드를 직접 적었는데 내 것이 아니면 같은 요구사항의 내 다른 단계로 넘겨짚지 않는다.
  const reqHit = exact.length ? [] : mine.filter((u) => hints.has(u.reqId.toUpperCase()));
  if (reqHit.length === 1) return { unit: reqHit[0].code, cands: [], why: `요구사항 ${reqHit[0].reqId}의 내 담당 단계` };
  if (reqHit.length > 1)
    return {
      unit: null,
      cands: reqHit.map((u) => u.code),
      why: `요구사항 ${reqHit[0].reqId}에 내 담당 단계가 ${reqHit.length}개`,
    };

  const other = exact[0] ?? units.find((u) => hints.has(u.reqId.toUpperCase()));
  if (other) {
    return { unit: null, cands: [], why: `${other.reqId}: 다른 담당자(${other.s.ownerNm || "미지정"})의 단계` };
  }
  return { unit: null, cands: [], why: "브랜치·대화에 요구사항 정보 없음" };
}

export interface Alloc {
  min: number;
  cost: number;
}

export interface Pending {
  session: StoredSession;
  cands: string[];
  why: string;
}

export interface Allocation {
  /** `${unit}|${date}` → 배정된 AI 시간·비용 */
  byUnitDay: Map<string, Alloc>;
  pending: Pending[];
  offCount: number;
}

export const unitDayKey = (unit: string, date: string) => `${unit}|${date}`;

export function allocate(sessions: StoredSession[], units: Unit[], rateOf: (tool: string) => number): Allocation {
  const byUnitDay = new Map<string, Alloc>();
  const pending: Pending[] = [];
  let offCount = 0;
  const add = (unit: string, date: string, min: number, tool: string) => {
    if (min <= 0) return;
    const k = unitDayKey(unit, date);
    const cur = byUnitDay.get(k) ?? { min: 0, cost: 0 };
    cur.min += min;
    cur.cost += (min / 60) * rateOf(tool);
    byUnitDay.set(k, cur);
  };
  for (const s of sessions) {
    const r = s.resolution;
    if (r?.kind === "OFF") {
      offCount++;
      continue;
    }
    if (r?.kind === "ASSIGN") {
      r.parts.forEach((p) => add(p.unit, s.workDt, p.min, s.tool));
      continue;
    }
    const m = matchSession(s, units);
    if (m.unit) add(m.unit, s.workDt, s.minutes, s.tool);
    else pending.push({ session: s, cands: m.cands, why: m.why });
  }
  return { byUnitDay, pending, offCount };
}

/** 대화·브랜치 텍스트에서 코드처럼 생긴 토큰만 뽑는다. 원문은 저장하지 않기 위해 수집 단계에서 쓴다. */
export function extractHints(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/([A-Za-z][A-Za-z0-9_]*-\d+)(-(?:AN|DS|DV|TS|DP|OP)\b)?/gi)) {
    out.add(m[0].toUpperCase());
    out.add(m[1].toUpperCase());
    if (out.size >= 20) break;
  }
  return Array.from(out);
}
