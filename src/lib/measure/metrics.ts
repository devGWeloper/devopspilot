// 측정 지표 계산은 이 파일에만 둔다 — 화면·엑셀·API 가 같은 숫자를 보여야 하기 때문.
import type { Project, Requirement, StageCd } from "../types";
import { allocate, unitDayKey, type AllocSrc, type Allocation, type Pending, type StoredSession } from "./match";
import { ACT_TYPES, type ActType, type AiSession, type DayConf, type EffortEntry, type Settings } from "./types";
import { reqBaseMd, reqDone, reqKey, unitCode, unitsOf, type Unit } from "./units";

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
  /** 요구사항 → 과제 ID — 요구사항 ID 가 과제 안에서만 유일해서 키를 만들 때 쓴다 */
  prjOf: Map<Requirement, string>;
}

/** 확정 키는 reqKey(과제ID-요구사항ID) 기준 */
export const confKey = (userId: string, rk: string, date: string) => `${userId}|${rk}|${date}`;
export const keyOf = (ix: Index, req: Requirement) => reqKey(ix.prjOf.get(req) ?? "", req.reqId);
const codeOf = (ix: Index, req: Requirement, cd: StageCd) => unitCode(ix.prjOf.get(req) ?? "", req.reqId, cd);

/**
 * 세션 AI 비용 = Σ모델 (입력 − 캐시) × 입력 단가 + 캐시 × 캐시 단가 + 출력 × 출력 단가 (원 / 100만 토큰).
 * 토큰이 없거나 단가표에 없는 모델이 하나라도 있으면 null — 일부만 더한 값을 실제 비용처럼 보이지 않게.
 */
export function sessionCost(settings: Settings, s: AiSession): number | null {
  const models = Object.entries(s.tokens ?? {});
  if (!models.length) return null;
  let sum = 0;
  for (const [model, t] of models) {
    const p = settings.tokenPrice[model];
    if (!p) return null;
    sum += (Math.max(0, t.input - t.cached) * p.input + t.cached * p.cached + t.output * p.output) / 1e6;
  }
  return sum;
}

export function buildIndex(data: MeasureData): Index {
  const units = unitsOf(data.projects);
  const unitByCode = new Map(units.map((u) => [u.code, u]));
  const alloc = allocate(data.sessions, units, (s) => sessionCost(data.settings, s));
  const effort = new Map(data.efforts.map((e) => [unitDayKey(e.unit, e.workDt), e]));
  const conf = new Map(data.confs.map((c) => [confKey(c.userId, reqKey(c.prjId, c.reqId), c.workDt), c]));
  const prjOf = new Map(data.projects.flatMap((p) => p.reqs.map((r) => [r, p.prjId] as const)));
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
  return { data, units, unitByCode, alloc, effort, conf, daysByUnit, prjOf };
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
  /** 비용을 알 수 없는 세션 조각 수 */
  aiNa: number;
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
  return { ai, mn, inT, out, tot: inT + out, aiCost: a?.cost ?? 0, aiNa: a?.na ?? 0, add: e?.add ?? {}, memo: e?.memo ?? "" };
}

export type RowSt = "conf" | "edit" | "need";

const r2 = (v: number) => Math.round(v * 100) / 100;

/** 확정 당시 값과 지금 값 — 단계별 투입(h). 확정 스냅샷과 비교하는 기준 */
export function daySnap(ix: Index, userId: string, req: Requirement, date: string): Record<string, number> {
  const o: Record<string, number> = {};
  for (const s of req.stages) {
    if (s.ownerId !== userId) continue;
    const code = codeOf(ix, req, s.cd);
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
  const c = ix.conf.get(confKey(userId, keyOf(ix, req), date));
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
    ix.daysByUnit.get(codeOf(ix, req, s.cd))?.forEach((d) => dates.add(d));
  }
  const prjId = ix.prjOf.get(req);
  ix.conf.forEach((c) => {
    if (c.userId === userId && c.prjId === prjId && c.reqId === req.reqId) dates.add(c.workDt);
  });
  return Array.from(dates)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => ({ date, ...dayState(ix, userId, req, date) }));
}

export type ReqStatus = "DONE" | "ING" | "WAIT";

export function reqStatus(ix: Index, req: Requirement): ReqStatus {
  if (reqDone(req)) return "DONE";
  return req.stages.some((s) => (ix.daysByUnit.get(codeOf(ix, req, s.cd))?.size ?? 0) > 0) ? "ING" : "WAIT";
}

/** 측정 상태 — 완료는 관리자가 태그마다 지정, 측정 중·대기는 입력 유무로 */
export function stageStatus(ix: Index, req: Requirement, cd: StageCd): ReqStatus {
  if (req.stages.find((s) => s.cd === cd)?.done) return "DONE";
  return (ix.daysByUnit.get(codeOf(ix, req, cd))?.size ?? 0) > 0 ? "ING" : "WAIT";
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
  /** 비용을 알 수 없어 AI 비용에서 빠진 세션 조각 수 */
  aiNa: number;
  totalCost: number;
  byType: Record<ActType, number>;
  /** 투입 공수 절감률 = 1 − 실제 ÷ 기준 */
  save: number | null;
  /** 절감 공수(M/D) = 기준 − 실제 */
  saveMd: number;
  /** 비용 순절감률 = (기준 인건비 − 실제 인건비 − AI 비용) ÷ 기준 인건비 */
  net: number | null;
  /** 비용 순절감액(원) */
  netAmt: number;
  /** AI 활용률 = AI 도구 내 ÷ 실제 투입 */
  use: number | null;
  /** AI 밖 비중 = AI 도구 외 ÷ 실제 투입 */
  outShare: number | null;
}

const emptyTypes = () => Object.fromEntries(ACT_TYPES.map((a) => [a.cd, 0])) as Record<ActType, number>;

/** 산출 근거 — 단위 × 일자 한 칸이 집계에 어떻게 들어갔는지 */
export interface TraceDay {
  date: string;
  /** 확정 상태 — 담당자가 없으면 need */
  st: RowSt;
  confirmedAt: string | null;
  counted: boolean;
  cell: Cell;
  sessions: AllocSrc[];
}

export interface TraceUnit {
  unit: Unit;
  price: number;
  days: TraceDay[];
  /** 집계에 들어간 투입(h) */
  tot: number;
}

/** 집계 대상 날과 빠진 날을 모두 돌려준다 — 측정 결과 숫자는 이것을 더한 값이다(aggTrace). */
export function traceUnits(ix: Index, units: Unit[], confirmedOnly: boolean): TraceUnit[] {
  const s = ix.data.settings;
  return units.map((u) => {
    const days = Array.from(ix.daysByUnit.get(u.code) ?? [])
      .sort()
      .map((date): TraceDay => {
        const st = u.ownerId ? dayState(ix, u.ownerId, u.req, date).st : "need";
        const c = u.ownerId ? ix.conf.get(confKey(u.ownerId, u.reqKey, date)) : undefined;
        return {
          date,
          st,
          confirmedAt: st === "conf" ? (c?.confirmedAt ?? null) : null,
          counted: !confirmedOnly || st === "conf",
          cell: cellOf(ix, u.code, date),
          sessions: ix.alloc.srcByUnitDay.get(unitDayKey(u.code, date)) ?? [],
        };
      });
    return { unit: u, price: s.gradePrice[u.s.grade] ?? 0, days, tot: days.filter((d) => d.counted).reduce((a, d) => a + d.cell.tot, 0) };
  });
}

export function aggTrace(ix: Index, trace: TraceUnit[]): Agg {
  const s = ix.data.settings;
  const o: Agg = {
    reqN: new Set(trace.map((t) => t.unit.reqKey)).size,
    unitN: trace.length,
    baseMd: 0,
    md: 0,
    inT: 0,
    out: 0,
    tot: 0,
    ai: 0,
    baseCost: 0,
    labor: 0,
    aiCost: 0,
    aiNa: 0,
    totalCost: 0,
    byType: emptyTypes(),
    save: null,
    saveMd: 0,
    net: null,
    netAmt: 0,
    use: null,
    outShare: null,
  };
  for (const t of trace) {
    o.baseMd += t.unit.s.baseMd;
    o.baseCost += t.unit.s.baseMd * t.price;
    for (const d of t.days) {
      if (!d.counted) continue;
      o.inT += d.cell.inT;
      o.out += d.cell.out;
      o.ai += d.cell.ai;
      o.aiCost += d.cell.aiCost;
      o.aiNa += d.cell.aiNa;
      for (const [k, h] of Object.entries(d.cell.add)) o.byType[k as ActType] += h ?? 0;
    }
    o.tot += t.tot;
    o.labor += (t.tot / s.mdHours) * t.price;
  }
  o.md = o.tot / s.mdHours;
  o.totalCost = o.labor + o.aiCost;
  o.save = o.baseMd > 0 ? 1 - o.md / o.baseMd : null;
  o.saveMd = o.baseMd - o.md;
  o.netAmt = o.baseCost - o.labor - o.aiCost;
  o.net = o.baseCost > 0 ? o.netAmt / o.baseCost : null;
  o.use = o.tot > 0 ? o.inT / o.tot : null;
  o.outShare = o.tot > 0 ? o.out / o.tot : null;
  return o;
}

/**
 * confirmedOnly 면 확정된 날만 더한다 — 확정 전 값은 개발자가 아직 고칠 수 있어 결과로 보이면 안 된다.
 * 공수 진척(현황·투입 공수 화면)은 입력 중인 값도 보여 줘야 하므로 false 로 부른다.
 */
export function aggUnits(ix: Index, units: Unit[], confirmedOnly: boolean): Agg {
  return aggTrace(ix, traceUnits(ix, units, confirmedOnly));
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
      const h = cellOf(ix, codeOf(ix, req, s.cd), r.date).tot;
      byStage[s.cd] = (byStage[s.cd] ?? 0) + h;
      tot += h;
    }
  }
  return { byStage, tot, md: tot / ix.data.settings.mdHours };
}

export const reqsOwnedBy = (ix: Index, userId: string) => ix.data.projects.flatMap((p) => p.reqs).filter((r) => r.stages.some((s) => s.ownerId === userId));

/** 개발자에게 입력·확정 기록이 있는 날 */
export function userDates(ix: Index, userId: string): string[] {
  const out = new Set<string>();
  for (const r of reqsOwnedBy(ix, userId)) rowsOf(ix, userId, r).forEach((x) => out.add(x.date));
  return Array.from(out);
}

// ---------- 보조 · 관리 지표 ----------

export interface Ratio {
  num: number;
  den: number;
  rate: number | null;
}
const ratio = (num: number, den: number): Ratio => ({ num, den, rate: den > 0 ? num / den : null });

/** 태그 입력률 = 태그로 자동 배정된 AI 시간(분) ÷ 수집된 AI 시간 전체(분). 직접 배정·업무 외·미배정은 분모에만 */
export function tagRate(ix: Index, userIds: Set<string> | null): Ratio {
  const ss = ix.data.sessions.filter((s) => (!userIds || userIds.has(s.userId)) && s.workDt >= ix.data.settings.measureStart);
  return ratio(
    ss.filter((s) => ix.alloc.auto.has(s.datId)).reduce((a, s) => a + s.minutes, 0),
    ss.reduce((a, s) => a + s.minutes, 0),
  );
}

const KST_MS = 9 * 3600 * 1000;

/** 일자 D 의 확정 마감 = 다음 영업일(주말 건너뜀) 23:59:59 KST 를 UTC ISO 로 */
export function nextDayDeadline(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return new Date(d.getTime() + 86400000 - 1000 - KST_MS).toISOString();
}

/**
 * 다음 날 확정률 = 다음 영업일 안에 그날 입력을 모두 처음 확정한 (사번·일자) ÷ 기록이 있는 (사번·일자).
 * 마감이 아직 지나지 않은 날은 판정할 수 없어 뺀다. 재확정은 판정을 바꾸지 않는다(첫 확정 시각).
 */
export function nextDayConfRate(ix: Index, userIds: Set<string> | null, nowIso: string): Ratio & { late: { userId: string; date: string }[] } {
  let num = 0;
  let den = 0;
  const late: { userId: string; date: string }[] = [];
  const owners = Array.from(new Set(ix.units.map((u) => u.ownerId).filter((x): x is string => !!x && (!userIds || userIds.has(x)))));
  for (const userId of owners) {
    const reqs = reqsOwnedBy(ix, userId);
    for (const date of userDates(ix, userId)) {
      if (date < ix.data.settings.measureStart) continue;
      const due = nextDayDeadline(date);
      if (due > nowIso) continue;
      const dayReqs = reqs.filter((r) => rowsOf(ix, userId, r).some((x) => x.date === date));
      if (!dayReqs.length) continue;
      den++;
      const onTime = dayReqs.every((r) => {
        const c = ix.conf.get(confKey(userId, keyOf(ix, r), date));
        const at = c?.firstConfirmedAt ?? c?.confirmedAt;
        return c?.state !== "EXTRA" && !!at && at <= due;
      });
      if (onTime) num++;
      else late.push({ userId, date });
    }
  }
  return { ...ratio(num, den), late };
}

/** 기준정보 엑셀 '05. 주요 집계 로직' — 화면·엑셀 내보내기가 같은 문구를 쓰도록 여기 둔다 */
export interface MetricDef {
  key: string;
  group: string;
  name: string;
  formula: string;
  note: string;
}

/** 1 M/D 분은 설정값이라 산식 문구에 그때그때 넣는다 */
export const metricDefs = (mdHours: number): MetricDef[] => [
  { key: "save", group: "주요", name: "투입 공수 절감률", formula: `1 − Σ실제 투입(분) ÷ Σ(기준 공수(M/D) × ${mdHours * 60})`, note: `확정된 날만 · ${mdHours * 60} = 1 M/D 분(설정 ${mdHours}시간 × 60)` },
  { key: "saveMd", group: "주요", name: "절감 공수 (M/D)", formula: `Σ(기준 공수(분) − 실제 투입(분)) ÷ ${mdHours * 60}`, note: "" },
  {
    key: "net",
    group: "주요",
    name: "비용 순절감률",
    formula: "(Σ기준 공수 × 등급 단가 − Σ실제 투입 공수 × 등급 단가 − ΣAI 비용) ÷ ( Σ기준 공수 × 등급 단가 )",
    note: "등급 단가 = 태그의 필요 개발자 등급 M/D 단가",
  },
  { key: "netAmt", group: "주요", name: "비용 순절감액 (원)", formula: "Σ기준 인건비 − Σ실제 인건비 − ΣAI 비용", note: "AI 비용 = 토큰 × 모델 토큰 단가 · 단가가 없으면 빈칸(0 으로 더함)" },
  { key: "use", group: "보조 · 활용", name: "AI 활용률", formula: "ΣAI 내 투입 ÷ Σ실제 투입", note: "AI 내 = 수집 시간 − 감소" },
  { key: "outShare", group: "보조 · 활용", name: "AI 밖 비중", formula: "ΣAI 밖 투입 ÷ Σ실제 투입", note: "AI 밖 = 작업 유형 A1~A8 수기 입력" },
  { key: "tag", group: "보조 · 관리", name: "태그 입력률", formula: "Σ태그 붙인 시간(분) ÷ ΣAI 구간 전체(분)", note: "태그 붙인 시간 = 브랜치·프롬프트의 공수 태그로 자동 배정된 시간 · 전체 = 직접 배정·업무 외·미배정 포함" },
  { key: "nextDay", group: "보조 · 관리", name: "다음 날 확정률", formula: "투입 공수 확정 사번 ÷ 대상 사번", note: "(사번·일자) 단위 · 다음 영업일 23:59 까지 그날 입력을 모두 처음 확정 · 마감 전인 날은 제외" },
];
