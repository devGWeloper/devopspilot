// 측정 지표 계산은 이 파일에만 둔다 — 화면·엑셀·API 가 같은 숫자를 보여야 하기 때문.
import type { Project, Requirement, StageCd } from "../types";
import { allocate, unitDayKey, type Allocation, type Pending, type StoredSession } from "./match";
import { ACT_TYPES, type ActType, type DayConf, type EffortEntry, type Settings } from "./types";
import { reqBaseMd, unitsOf, type Unit } from "./units";

export interface MeasureData {
  projects: Project[];
  efforts: EffortEntry[];
  confs: DayConf[];
  sessions: StoredSession[];
  settings: Settings;
}

export interface Index {
  data: MeasureData;
  units: Unit[];
  unitByCode: Map<string, Unit>;
  alloc: Allocation;
  effort: Map<string, EffortEntry>;
  conf: Map<string, DayConf>;
  /** 단위 → 데이터가 있는 일자들 */
  daysByUnit: Map<string, Set<string>>;
}

export const confKey = (userId: string, reqId: string, date: string) => `${userId}|${reqId}|${date}`;

export function rateOf(settings: Settings, tool: string): number {
  return settings.aiRate[tool] ?? settings.defaultAiRate;
}

export function buildIndex(data: MeasureData): Index {
  const units = unitsOf(data.projects);
  const unitByCode = new Map(units.map((u) => [u.code, u]));
  const alloc = allocate(data.sessions, units, (t) => rateOf(data.settings, t));
  const effort = new Map(data.efforts.map((e) => [unitDayKey(e.unit, e.workDt), e]));
  const conf = new Map(data.confs.map((c) => [confKey(c.userId, c.reqId, c.workDt), c]));
  const daysByUnit = new Map<string, Set<string>>();
  const mark = (k: string) => {
    const [unit, date] = k.split("|");
    if (!daysByUnit.has(unit)) daysByUnit.set(unit, new Set());
    daysByUnit.get(unit)!.add(date);
  };
  alloc.byUnitDay.forEach((_, k) => mark(k));
  effort.forEach((e, k) => {
    if (hasEffort(e)) mark(k);
  });
  return { data, units, unitByCode, alloc, effort, conf, daysByUnit };
}

const hasEffort = (e: EffortEntry) => e.reduceH > 0 || addSum(e.add) > 0 || !!e.memo;
const addSum = (a: Partial<Record<ActType, number>>) => Object.values(a).reduce<number>((s, v) => s + (v ?? 0), 0);

export interface Cell {
  /** AI 수집 시간(h) */
  ai: number;
  /** 수집 시간 중 감소(h) */
  mn: number;
  /** AI 도구 내 = 수집 − 감소 */
  inT: number;
  /** AI 도구 외 */
  out: number;
  tot: number;
  aiCost: number;
  add: Partial<Record<ActType, number>>;
  memo: string;
}

export function cellOf(ix: Index, unit: string, date: string): Cell {
  const a = ix.alloc.byUnitDay.get(unitDayKey(unit, date));
  const e = ix.effort.get(unitDayKey(unit, date));
  const ai = (a?.min ?? 0) / 60;
  const mn = Math.min(ai, e?.reduceH ?? 0);
  const inT = ai - mn;
  const out = e ? addSum(e.add) : 0;
  return { ai, mn, inT, out, tot: inT + out, aiCost: a?.cost ?? 0, add: e?.add ?? {}, memo: e?.memo ?? "" };
}

export type RowSt = "conf" | "edit" | "need";

const r2 = (v: number) => Math.round(v * 100) / 100;

/** 확정 당시 값과 지금 값 — 단계별 투입(h). 확정 스냅샷과 비교하는 기준 */
export function daySnap(ix: Index, userId: string, req: Requirement, date: string): Record<string, number> {
  const o: Record<string, number> = {};
  for (const s of req.stages) {
    if (s.ownerId !== userId) continue;
    const code = `${req.reqId}-${s.cd}`;
    const t = r2(cellOf(ix, code, date).tot);
    if (t > 0) o[code] = t;
  }
  return o;
}

function sameSnap(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return Array.from(keys).every((k) => (a[k] ?? 0) === (b[k] ?? 0));
}

export function dayState(ix: Index, userId: string, req: Requirement, date: string): { st: RowSt; revCount: number; changed: boolean } {
  const c = ix.conf.get(confKey(userId, req.reqId, date));
  if (c?.state === "CONF") {
    const changed = !sameSnap(c.snap ?? {}, daySnap(ix, userId, req, date));
    return { st: changed ? "edit" : "conf", revCount: c.revCount, changed };
  }
  return { st: c?.state === "EDIT" ? "edit" : "need", revCount: c?.revCount ?? 0, changed: false };
}

/** 개발자 × 요구사항 일자 줄 — 데이터가 있거나 '기록 없는 날 추가'로 만든 날 */
export function rowsOf(
  ix: Index,
  userId: string,
  req: Requirement,
): { date: string; st: RowSt; revCount: number; changed: boolean }[] {
  const dates = new Set<string>();
  for (const s of req.stages) {
    if (s.ownerId !== userId) continue;
    ix.daysByUnit.get(`${req.reqId}-${s.cd}`)?.forEach((d) => dates.add(d));
  }
  ix.conf.forEach((c) => {
    if (c.userId === userId && c.reqId === req.reqId) dates.add(c.workDt);
  });
  return Array.from(dates)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => ({ date, ...dayState(ix, userId, req, date) }));
}

export function needCount(ix: Index, userId: string, req: Requirement): number {
  return rowsOf(ix, userId, req).filter((r) => r.st !== "conf").length;
}

export type ReqStatus = "DONE" | "ING" | "WAIT";

export function reqStatus(ix: Index, req: Requirement): ReqStatus {
  if (req.done) return "DONE";
  return req.stages.some((s) => (ix.daysByUnit.get(`${req.reqId}-${s.cd}`)?.size ?? 0) > 0) ? "ING" : "WAIT";
}

export function stageStatus(ix: Index, req: Requirement, cd: StageCd): ReqStatus {
  if (req.done) return "DONE";
  return (ix.daysByUnit.get(`${req.reqId}-${cd}`)?.size ?? 0) > 0 ? "ING" : "WAIT";
}

export interface Agg {
  reqN: number;
  unitN: number;
  baseMd: number;
  md: number;
  inT: number;
  out: number;
  tot: number;
  ai: number;
  baseCost: number;
  labor: number;
  aiCost: number;
  totalCost: number;
  byType: Record<ActType, number>;
  /** (기준 − 투입) ÷ 기준 */
  save: number | null;
  /** (기준 인건비 − 측정 인건비 − AI 비용) ÷ 기준 인건비 */
  net: number | null;
  /** AI 도구 내 ÷ 투입 */
  use: number | null;
}

const emptyTypes = () => Object.fromEntries(ACT_TYPES.map((a) => [a.cd, 0])) as Record<ActType, number>;

/**
 * confirmedOnly 면 확정된 날만 더한다 — 확정 전 값은 개발자가 아직 고칠 수 있어 결과로 보이면 안 된다.
 * 공수 진척(현황·투입 공수 화면)은 입력 중인 값도 보여 줘야 하므로 false 로 부른다.
 */
export function aggUnits(ix: Index, units: Unit[], confirmedOnly: boolean): Agg {
  const s = ix.data.settings;
  const o: Agg = {
    reqN: new Set(units.map((u) => u.reqId)).size,
    unitN: units.length,
    baseMd: 0,
    md: 0,
    inT: 0,
    out: 0,
    tot: 0,
    ai: 0,
    baseCost: 0,
    labor: 0,
    aiCost: 0,
    totalCost: 0,
    byType: emptyTypes(),
    save: null,
    net: null,
    use: null,
  };
  for (const u of units) {
    const price = s.gradePrice[u.req.grade] ?? 0;
    o.baseMd += u.s.baseMd;
    o.baseCost += u.s.baseMd * price;
    let uTot = 0;
    ix.daysByUnit.get(u.code)?.forEach((date) => {
      if (confirmedOnly && (!u.ownerId || dayState(ix, u.ownerId, u.req, date).st !== "conf")) return;
      const c = cellOf(ix, u.code, date);
      o.inT += c.inT;
      o.out += c.out;
      o.ai += c.ai;
      o.aiCost += c.aiCost;
      uTot += c.tot;
      for (const [t, h] of Object.entries(c.add)) o.byType[t as ActType] += h ?? 0;
    });
    o.tot += uTot;
    o.labor += (uTot / s.mdHours) * price;
  }
  o.md = o.tot / s.mdHours;
  o.totalCost = o.labor + o.aiCost;
  o.save = o.baseMd > 0 ? (o.baseMd - o.md) / o.baseMd : null;
  o.net = o.baseCost > 0 ? (o.baseCost - o.labor - o.aiCost) / o.baseCost : null;
  o.use = o.tot > 0 ? o.inT / o.tot : null;
  return o;
}

export const unitsOfReq = (ix: Index, req: Requirement) => ix.units.filter((u) => u.req === req);

export function reqProgress(ix: Index, req: Requirement): { md: number; baseMd: number } {
  return { md: aggUnits(ix, unitsOfReq(ix, req), false).md, baseMd: reqBaseMd(req) };
}

export function pendingOf(ix: Index, userId: string | null): Pending[] {
  return ix.alloc.pending.filter((p) => !userId || p.session.userId === userId);
}

/** 개발자 한 명의 요구사항 확정 합계 — 투입 공수 화면 맨 윗줄 */
export function confirmedSum(ix: Index, userId: string, req: Requirement): { byStage: Partial<Record<StageCd, number>>; tot: number; md: number } {
  const byStage: Partial<Record<StageCd, number>> = {};
  let tot = 0;
  for (const r of rowsOf(ix, userId, req)) {
    if (r.st !== "conf") continue;
    for (const s of req.stages) {
      if (s.ownerId !== userId) continue;
      const h = cellOf(ix, `${req.reqId}-${s.cd}`, r.date).tot;
      byStage[s.cd] = (byStage[s.cd] ?? 0) + h;
      tot += h;
    }
  }
  return { byStage, tot, md: tot / ix.data.settings.mdHours };
}
