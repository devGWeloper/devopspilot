// 화면별로 서버가 내려줄 직렬화 가능한 데이터. 숫자 계산은 measure/metrics.ts 를 부르기만 한다.
import { canSee, type Actor } from "./auth/permissions";
import { DIMS, catsOf, dimValues, type DimKey } from "./dims";
import { aggTrace, aggUnits, cellOf, metricDefs, nextDayConfRate, pendingOf, reqsOwnedBy, sessionCost, tagRate, traceUnits, reqStatus, rowsOf, stageStatus, unitsOfReq, type Agg, type Cell, type Index, type MetricDef, type Ratio, type ReqStatus, type RowSt } from "./measure/metrics";
import { unitDayKey } from "./measure/match";
import { detectAnomalies, type Anomaly } from "./measure/monitor";
import type { EffortSpan } from "./measure/spans";
import type { ActType, MonitorNote, TokenPrice } from "./measure/types";
import { reqBaseMd, reqDone, reqKey, type Unit } from "./measure/units";
import { formValues } from "./projects/form";
import { STAGE_LABEL, STAGES, type Project, type Requirement, type Stage, type StageCd, type UserRecord } from "./types";

export type ProjectInfo = Omit<Project, "reqs">;

/** 공수 태그 한 행 — 기준정보 엑셀 '02. 요구사항-SDLC' 의 항목 + 진척 */
export interface StageVM extends Stage {
  code: string;
  md: number;
  status: ReqStatus;
}

export interface ReqVM {
  prjId: string;
  reqId: string;
  /** 과제ID-요구사항ID */
  rk: string;
  name: string;
  done: boolean;
  status: ReqStatus;
  baseMd: number;
  md: number;
  inT: number;
  out: number;
  stages: StageVM[];
}

/** 요구사항명은 엑셀에 없어 비어 있을 수 있다 */
export const reqLabel = (r: { reqId: string; name: string }) => (r.name && r.name !== r.reqId ? `${r.reqId} ${r.name}` : r.reqId);

function reqVM(ix: Index, prj: Project, req: Requirement): ReqVM {
  const a = aggUnits(ix, unitsOfReq(ix, req), false);
  return {
    prjId: prj.prjId,
    reqId: req.reqId,
    rk: reqKey(prj.prjId, req.reqId),
    name: req.name,
    done: reqDone(req),
    status: reqStatus(ix, req),
    baseMd: reqBaseMd(req),
    md: a.md,
    inT: a.inT,
    out: a.out,
    stages: unitsOfReq(ix, req).map((u) => ({
      ...u.s,
      ownerNm: u.s.ownerNm || u.s.ownerId || "미지정",
      code: u.code,
      md: aggUnits(ix, [u], false).md,
      status: stageStatus(ix, req, u.stage),
    })),
  };
}

const info = ({ reqs: _r, ...p }: Project): ProjectInfo => p;

// ---------- PoC 과제 현황 ----------
export interface StatusVM {
  projects: { info: ProjectInfo; reqs: ReqVM[]; md: number; baseMd: number; doneN: number }[];
}

export function statusView(ix: Index, actor: Actor): StatusVM {
  return {
    projects: ix.data.projects
      .map((p) => {
        const reqs = p.reqs.filter((r) => canSee(actor, r)).map((r) => reqVM(ix, p, r));
        return {
          info: info(p),
          reqs,
          md: reqs.reduce((a, r) => a + r.md, 0),
          baseMd: reqs.reduce((a, r) => a + r.baseMd, 0),
          doneN: reqs.filter((r) => r.done).length,
        };
      })
      // 관리자는 요구사항이 아직 없는 과제도 봐야 입력할 수 있다.
      .filter((p) => p.reqs.length > 0 || actor.role === "ADMIN"),
  };
}

// ---------- 공수 입력 (일일 공수표) ----------
export interface CellVM {
  ai: number;
  mn: number;
  inT: number;
  out: number;
  tot: number;
  add: Partial<Record<ActType, number>>;
  /** 직접 입력 시간대 */
  spans: EffortSpan[];
  memo: string;
}

export interface PendingVM {
  datId: string;
  date: string;
  start: string;
  end: string;
  minutes: number;
  tool: string;
  branch: string;
  why: string;
  options: { code: string; label: string; cand: boolean }[];
}

/** 내 담당 단계 하나 — 공수 입력 표의 한 줄 */
export interface EffortUnitVM {
  code: string;
  stage: StageCd;
  workType: string;
  done: boolean;
  md: number;
  baseMd: number;
  inT: number;
  out: number;
}

/** AI 시간이 어떤 Codex 세션에서 왔는지 — 개발자가 자동 반영을 믿을 수 있게 */
export interface EffortSessVM {
  datId: string;
  src: "OTEL" | "LOG";
  start: string;
  end: string;
  min: number;
  how: string;
  /** 개발자가 직접 배정한 세션 — 잘못 넣었으면 되돌릴 수 있다 */
  manual: boolean;
}

export type EffortCellVM = CellVM & { sess: EffortSessVM[] };

export interface EffortReqVM {
  rk: string;
  reqId: string;
  name: string;
  prjId: string;
  prjNm: string;
  status: ReqStatus;
  /** 같은 요구사항의 다른 사람 단계 — 누구와 나눠 맡았는지 */
  others: { stage: StageCd; ownerNm: string }[];
  units: EffortUnitVM[];
}

/** 하루 — 그날 내 요구사항별 확정 상태와 단계별 칸 */
export interface EffortDayVM {
  date: string;
  /** 요구사항(rk)별 상태 — 기록이 있는 요구사항만 */
  st: Record<string, RowSt>;
  /** 공수 태그 → 칸 — 값이 있는 칸만 */
  cells: Record<string, EffortCellVM>;
  ai: number;
  out: number;
  tot: number;
  need: number;
  pending: number;
  /** 개발자가 '업무 외 사용'으로 뺀 세션 — 잘못 뺐으면 되돌릴 수 있다 */
  off: { datId: string; start: string; end: string; minutes: number }[];
}

export interface EffortStatsVM {
  needDays: number;
  pendN: number;
  pendH: number;
  /** 확정된 날의 Codex(AI 도구 내)·그 외 시간 합 */
  confAi: number;
  confOut: number;
  /** 마지막으로 들어온 Codex 세션 */
  last: { date: string; time: string; src: "OTEL" | "LOG" } | null;
}

export interface EffortVM {
  userId: string;
  userNm: string;
  devs: { userId: string; userNm: string }[];
  today: string;
  mdHours: number;
  /** 기본 근무시간 — 이 밖의 입력은 받되 타임라인에 근무시간 외로 보인다 */
  work: { start: string; end: string };
  reqs: EffortReqVM[];
  /** 최신 날짜부터 */
  days: EffortDayVM[];
  pending: PendingVM[];
  stats: EffortStatsVM;
}

const cellVM = (c: Cell, spans: EffortSpan[] = []): CellVM => ({ ai: c.ai, mn: c.mn, inT: c.inT, out: c.out, tot: c.tot, add: c.add, spans, memo: c.memo });

/** 기록이 없어도 최근 며칠은 날짜 목록에 둔다 — 오늘 한 일을 바로 넣을 수 있게 */
const RECENT_DAYS = 7;

const minusDays = (ymd: string, n: number) => new Date(Date.parse(ymd) - n * 86400000).toISOString().slice(0, 10);

export function effortView(ix: Index, users: UserRecord[], userId: string, today: string): EffortVM {
  const devs = users.filter((u) => u.role === "DEVELOPER" && u.useYn).map((u) => ({ userId: u.userId, userNm: u.userNm }));
  const mineUnits = ix.units.filter((u) => u.ownerId === userId);
  const byReq = new Map<Requirement, Unit[]>();
  mineUnits.forEach((u) => byReq.set(u.req, [...(byReq.get(u.req) ?? []), u]));

  const days = new Map<string, EffortDayVM>();
  const dayOf = (date: string) => {
    let d = days.get(date);
    if (!d) days.set(date, (d = { date, st: {}, cells: {}, ai: 0, out: 0, tot: 0, need: 0, pending: 0, off: [] }));
    return d;
  };
  for (let i = 0; i < RECENT_DAYS; i++) dayOf(minusDays(today, i));

  const mine = ix.data.sessions.filter((x) => x.userId === userId);
  const sessById = new Map(mine.map((x) => [x.datId, x]));
  let confAi = 0;
  let confOut = 0;
  const reqs = Array.from(byReq, ([req, us]): EffortReqVM => {
    const rk = us[0].reqKey;
    for (const r of rowsOf(ix, userId, req)) {
      const d = dayOf(r.date);
      d.st[rk] = r.st;
      if (r.st !== "conf") d.need++;
      for (const u of us) {
        const c = cellOf(ix, u.code, r.date);
        if (!c.ai && !c.out) continue;
        const sess = (ix.alloc.srcByUnitDay.get(unitDayKey(u.code, r.date)) ?? []).map((x) => ({
          datId: x.datId,
          src: x.src,
          start: x.start,
          end: x.end,
          min: x.min,
          how: x.how,
          manual: sessById.get(x.datId)?.resolution?.kind === "ASSIGN",
        }));
        d.cells[u.code] = { ...cellVM(c, ix.effort.get(unitDayKey(u.code, r.date))?.spans), sess };
        d.ai += c.inT;
        d.out += c.out;
        d.tot += c.tot;
        if (r.st === "conf") {
          confAi += c.inT;
          confOut += c.out;
        }
      }
    }
    return {
      rk,
      reqId: req.reqId,
      name: req.name && req.name !== req.reqId ? req.name : "",
      prjId: us[0].prj.prjId,
      prjNm: us[0].prj.prjNm,
      status: reqStatus(ix, req),
      others: req.stages.filter((s) => s.ownerId !== userId).map((s) => ({ stage: s.cd, ownerNm: s.ownerNm || s.ownerId || "미지정" })),
      units: STAGES.flatMap((cd) => {
        const u = us.find((x) => x.stage === cd);
        if (!u) return [];
        const a = aggUnits(ix, [u], false);
        return [{ code: u.code, stage: cd, workType: u.s.workType, done: u.s.done, md: a.md, baseMd: u.s.baseMd, inT: a.inT, out: a.out }];
      }),
    };
  });

  const label = (code: string) => {
    const u = ix.unitByCode.get(code);
    return u ? `${reqLabel(u.req)} · ${STAGE_LABEL[u.stage]}` : code;
  };
  const open = mineUnits.filter((u) => !u.s.done).map((u) => u.code);
  const pending = pendingOf(ix, userId)
    .sort((x, y) => x.session.workDt.localeCompare(y.session.workDt) || x.session.start.localeCompare(y.session.start))
    .map(
      (p): PendingVM => ({
        datId: p.session.datId,
        date: p.session.workDt,
        start: p.session.start,
        end: p.session.end,
        minutes: p.session.minutes,
        tool: p.session.tool,
        branch: p.session.branch,
        why: p.why,
        options: [...p.cands.map((code) => ({ code, label: label(code), cand: true })), ...open.filter((c) => !p.cands.includes(c)).map((code) => ({ code, label: label(code), cand: false }))],
      }),
    );
  pending.forEach((p) => dayOf(p.date).pending++);
  for (const x of mine)
    if (x.resolution?.kind === "OFF") dayOf(x.workDt).off.push({ datId: x.datId, start: x.start, end: x.end, minutes: x.minutes });

  const lastS = mine.reduce<(typeof mine)[number] | null>((a, x) => (!a || `${x.workDt} ${x.end}` > `${a.workDt} ${a.end}` ? x : a), null);
  const list = Array.from(days.values()).sort((a, b) => b.date.localeCompare(a.date));
  return {
    userId,
    userNm: users.find((u) => u.userId === userId)?.userNm ?? userId,
    devs,
    today,
    mdHours: ix.data.settings.mdHours,
    work: { start: ix.data.settings.workStart, end: ix.data.settings.workEnd },
    reqs,
    days: list,
    pending,
    stats: {
      needDays: list.filter((d) => d.need > 0).length,
      pendN: pending.length,
      pendH: pending.reduce((a, p) => a + p.minutes, 0) / 60,
      confAi,
      confOut,
      last: lastS ? { date: lastS.workDt, time: lastS.end || lastS.start, src: lastS.src } : null,
    },
  };
}

// ---------- 측정 결과 ----------
export interface MatrixCellVM {
  status: ReqStatus;
  ownerNm: string;
  /** 집계 범위 안일 때만 */
  agg: Agg | null;
}

export interface MatrixRowVM {
  rk: string;
  reqId: string;
  name: string;
  prjId: string;
  prjNm: string;
  cells: Partial<Record<StageCd, MatrixCellVM>>;
  total: Agg;
}

export interface DashFilter {
  prjId: string;
  includeIng: boolean;
}

export interface DashVM {
  filter: DashFilter;
  projectOptions: { prjId: string; prjNm: string }[];
  total: Agg;
  /** 보조 · 관리 지표 — 범위 안 담당자 기준 */
  tag: Ratio;
  nextDay: Ratio;
  metrics: MetricDef[];
  stages: { cd: StageCd; agg: Agg; workTypes: { workType: string; agg: Agg }[] }[];
  projects: {
    prjId: string;
    prjNm: string;
    doneN: number;
    reqN: number;
    agg: Agg;
    /** 단계별 — 단계 흐름(워터폴) 그림용 */
    stages: Partial<Record<StageCd, Agg>>;
    /** 과제 단위 성격 값 — AI 비용 × 절감률 분포의 범례 */
    dims: Partial<Record<DimKey, string>>;
  }[];
  reqs: { rk: string; reqId: string; name: string; prjId: string; prjNm: string; status: ReqStatus; agg: Agg }[];
  /** 요구사항 × 단계 기준 대비 — 관리자용. 집계 범위 밖 단계는 숫자 없이 상태만 */
  matrix: MatrixRowVM[];
  /** 과제 성격(분류 축)별 결과 — 태그 단위 */
  byDim: { key: DimKey; title: string; rows: { cat: string; reqN: number; agg: Agg }[] }[];
  settings: { mdHours: number; gradePrice: Record<string, number> };
}

/**
 * 측정 결과·산출 근거가 같은 범위를 쓰도록. 측정 완료는 태그마다 지정하므로 범위도 태그 단위 —
 * 기본은 완료 태그만, '측정 중 포함'이면 입력이 있는 태그까지.
 */
function scopeOf(ix: Index, actor: Actor, filter: DashFilter) {
  const visible = ix.data.projects.map((p) => ({ p, reqs: p.reqs.filter((r) => canSee(actor, r)) })).filter((x) => x.reqs.length);
  const seen = new Set(visible.flatMap((x) => x.reqs));
  const inScope = (u: Unit) =>
    seen.has(u.req) &&
    (!filter.prjId || u.prjId === filter.prjId) &&
    (u.s.done || (filter.includeIng && stageStatus(ix, u.req, u.stage) === "ING"));
  const units = ix.units.filter(inScope);
  return { visible, reqSet: new Set(units.map((u) => u.req)), units };
}

const ownersIn = (units: Unit[]) => new Set(units.map((u) => u.ownerId).filter((x): x is string => !!x));

export function dashView(ix: Index, actor: Actor, filter: DashFilter, nowIso: string): DashVM {
  const { visible, reqSet, units } = scopeOf(ix, actor, filter);
  const projectOptions = visible.map((x) => ({ prjId: x.p.prjId, prjNm: x.p.prjNm }));
  const agg = (us: typeof units) => aggUnits(ix, us, true);

  const stages = STAGES.filter((cd) => units.some((u) => u.stage === cd)).map((cd) => {
    const su = units.filter((u) => u.stage === cd);
    const wts = Array.from(new Set(su.map((u) => u.s.workType)));
    return { cd, agg: agg(su), workTypes: wts.map((workType) => ({ workType, agg: agg(su.filter((u) => u.s.workType === workType)) })) };
  });
  const projects = visible
    .filter((x) => units.some((u) => u.prj === x.p))
    .map((x) => {
      const pu = units.filter((u) => u.prj === x.p);
      const dv = pu[0] ? dimValues(x.p, pu[0].s) : null;
      return {
        prjId: x.p.prjId,
        prjNm: x.p.prjNm,
        doneN: x.reqs.filter((r) => reqDone(r)).length,
        reqN: x.reqs.length,
        agg: agg(pu),
        stages: Object.fromEntries(STAGES.filter((cd) => pu.some((u) => u.stage === cd)).map((cd) => [cd, agg(pu.filter((u) => u.stage === cd))])),
        dims: Object.fromEntries(DIMS.filter((d) => d.level === "prj").map((d) => [d.key, dv?.[d.key] ?? ""])),
      };
    });
  const reqs = visible.flatMap((x) =>
    x.reqs
      .filter((r) => reqSet.has(r))
      .map((r) => ({ rk: reqKey(x.p.prjId, r.reqId), reqId: r.reqId, name: r.name, prjId: x.p.prjId, prjNm: x.p.prjNm, status: reqStatus(ix, r), agg: agg(units.filter((u) => u.req === r)) })),
  );
  const vals = new Map(units.map((u) => [u, dimValues(u.prj, u.s)]));
  const byDim = DIMS.map((d) => {
    const seen = Array.from(vals.values()).map((v) => v[d.key]);
    const row = (cat: string, us: Unit[]) => ({ cat, reqN: us.length, agg: agg(us) });
    return {
      key: d.key,
      title: d.title,
      rows: catsOf(d, seen)
        .map((cat) => row(cat, units.filter((u) => vals.get(u)?.[d.key] === cat)))
        .concat(seen.some((v) => !v) ? [row("미입력", units.filter((u) => !vals.get(u)?.[d.key]))] : []),
    };
  });
  const inScope = new Set(units);
  const matrix = visible.flatMap((x) =>
    x.reqs
      .filter((r) => reqSet.has(r))
      .map((r): MatrixRowVM => {
        const us = unitsOfReq(ix, r);
        const cells: Partial<Record<StageCd, MatrixCellVM>> = {};
        for (const u of us) cells[u.stage] = { status: stageStatus(ix, r, u.stage), ownerNm: u.s.ownerNm || u.ownerId || "미지정", agg: inScope.has(u) ? agg([u]) : null };
        return { rk: reqKey(x.p.prjId, r.reqId), reqId: r.reqId, name: r.name && r.name !== r.reqId ? r.name : "", prjId: x.p.prjId, prjNm: x.p.prjNm, cells, total: agg(us.filter((u) => inScope.has(u))) };
      }),
  );
  const owners = ownersIn(units);
  return {
    filter,
    matrix,
    projectOptions,
    byDim,
    tag: tagRate(ix, owners),
    nextDay: nextDayConfRate(ix, owners, nowIso),
    metrics: metricDefs(ix.data.settings.mdHours),
    total: agg(units),
    stages,
    projects,
    reqs,
    settings: { mdHours: ix.data.settings.mdHours, gradePrice: ix.data.settings.gradePrice },
  };
}

// ---------- 시스템 관리 ----------
export interface ConfMatrixVM {
  days: string[];
  nextDay: Ratio;
  rows: { userId: string; userNm: string; cells: (number | null)[]; rate: number | null; nextDay: Ratio }[];
}

/** 개발자 × 일자 — 숫자 = 확정 필요 요구사항 수, 0 = 모두 확정, null = 입력 없음 */
export function confMatrix(ix: Index, users: UserRecord[], days: string[], nowIso: string): ConfMatrixVM {
  const devs = users.filter((u) => u.role === "DEVELOPER" && u.useYn);
  return {
    days,
    nextDay: nextDayConfRate(ix, new Set(devs.map((d) => d.userId)), nowIso),
    rows: devs.map((d) => {
      const rowsBy = reqsOwnedBy(ix, d.userId).map((r) => rowsOf(ix, d.userId, r));
      let tot = 0;
      let ok = 0;
      const cells = days.map((date) => {
        const sts = rowsBy.flatMap((rows) => rows.filter((x) => x.date === date).map((x) => x.st));
        if (!sts.length) return null;
        const n = sts.filter((x) => x !== "conf").length;
        tot += sts.length;
        ok += sts.length - n;
        return n;
      });
      return { userId: d.userId, userNm: d.userNm, cells, rate: tot ? ok / tot : null, nextDay: nextDayConfRate(ix, new Set([d.userId]), nowIso) };
    }),
  };
}

export interface CollectRowVM {
  userId: string;
  userNm: string;
  date: string;
  src: string;
  sessions: number;
  minutes: number;
  pending: number;
  /** 태그로 자동 배정된 분 */
  tagged: number;
  tokens: number;
  /** 비용을 알 수 있는 세션만 더한 값, 하나도 없으면 null */
  cost: number | null;
  costNa: number;
}

export function collectLog(ix: Index, users: UserRecord[]): CollectRowVM[] {
  const names = new Map(users.map((u) => [u.userId, u.userNm]));
  const pend = new Set(ix.alloc.pending.map((p) => p.session.datId));
  const map = new Map<string, CollectRowVM>();
  for (const s of ix.data.sessions) {
    const k = `${s.userId}|${s.workDt}|${s.src}`;
    const r = map.get(k) ?? {
      userId: s.userId,
      userNm: names.get(s.userId) ?? s.userId,
      date: s.workDt,
      src: s.src,
      sessions: 0,
      minutes: 0,
      pending: 0,
      tagged: 0,
      tokens: 0,
      cost: null,
      costNa: 0,
    };
    r.sessions++;
    r.minutes += s.minutes;
    if (pend.has(s.datId)) r.pending++;
    if (ix.alloc.auto.has(s.datId)) r.tagged += s.minutes;
    r.tokens += Object.values(s.tokens ?? {}).reduce((a, t) => a + t.input + t.output, 0);
    const c = sessionCost(ix.data.settings, s);
    if (c === null) r.costNa++;
    else r.cost = (r.cost ?? 0) + c;
    map.set(k, r);
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date) || a.userNm.localeCompare(b.userNm));
}

// ---------- 과제 선정 현황 (Phase 1 결과 분포) ----------
/** 선정 현황 한 행 = 공수 태그 하나. reqId 자리에 태그 코드를 둔다(화면이 행 키로 쓴다). */
export interface SelReqVM {
  prjId: string;
  reqId: string;
  name: string;
  stage: StageCd;
  baseMd: number;
  status: ReqStatus;
  /** 선정 현황 항목 ID → 값 */
  values: Record<string, string>;
}

export interface SelPrjVM extends ProjectInfo {
  reqN: number;
  baseMd: number;
}

export interface SelectionVM {
  projects: SelPrjVM[];
  reqs: SelReqVM[];
}

export function selectionView(ix: Index, actor: Actor): SelectionVM {
  const visible = ix.data.projects.map((p) => ({ p, reqs: p.reqs.filter((r) => canSee(actor, r)) })).filter((x) => x.reqs.length);
  return {
    projects: visible.map(({ p, reqs }) => ({ ...info(p), reqN: reqs.length, baseMd: reqs.reduce((a, r) => a + reqBaseMd(r), 0) })),
    reqs: visible.flatMap(({ reqs }) =>
      reqs.flatMap((r) =>
        unitsOfReq(ix, r).map((u) => ({
          prjId: u.prjId,
          reqId: u.code,
          name: reqLabel(u.req),
          stage: u.stage,
          baseMd: u.s.baseMd,
          status: stageStatus(ix, u.req, u.stage),
          values: formValues(u.prj, u.req, u.s, u.code),
        })),
      ),
    ),
  };
}

// ---------- 산출 근거 ----------
export interface BasisDayVM {
  date: string;
  st: string;
  confirmedAt: string | null;
  counted: boolean;
  ai: number;
  mn: number;
  inT: number;
  out: number;
  tot: number;
  aiCost: number;
  aiNa: number;
  add: Partial<Record<ActType, number>>;
  memo: string;
  sessions: { src: string; tool: string; start: string; end: string; min: number; cost: number | null; tokens: number; how: string }[];
}

export interface BasisUnitVM {
  code: string;
  prjId: string;
  prjNm: string;
  reqId: string;
  reqName: string;
  stage: StageCd;
  ownerNm: string;
  grade: string;
  price: number;
  baseMd: number;
  tot: number;
  days: BasisDayVM[];
}

export interface BasisVM {
  filter: DashFilter;
  total: Agg;
  settings: { mdHours: number; gradePrice: Record<string, number>; tokenPrice: Record<string, TokenPrice> };
  units: BasisUnitVM[];
  excluded: { days: number; hours: number };
  pending: { n: number; hours: number };
  offCount: number;
}

export function basisView(ix: Index, actor: Actor, filter: DashFilter): BasisVM {
  const { units } = scopeOf(ix, actor, filter);
  const trace = traceUnits(ix, units, true);
  const s = ix.data.settings;
  const vm = trace.map(
    (t): BasisUnitVM => ({
      code: t.unit.code,
      prjId: t.unit.prj.prjId,
      prjNm: t.unit.prj.prjNm,
      reqId: t.unit.reqId,
      reqName: reqLabel(t.unit.req),
      stage: t.unit.stage,
      ownerNm: t.unit.s.ownerNm || t.unit.ownerId || "미지정",
      grade: t.unit.s.grade,
      price: t.price,
      baseMd: t.unit.s.baseMd,
      tot: t.tot,
      days: t.days.map((d) => ({
        date: d.date,
        st: d.st,
        confirmedAt: d.confirmedAt,
        counted: d.counted,
        ai: d.cell.ai,
        mn: d.cell.mn,
        inT: d.cell.inT,
        out: d.cell.out,
        tot: d.cell.tot,
        aiCost: d.cell.aiCost,
        aiNa: d.cell.aiNa,
        add: d.cell.add,
        memo: d.cell.memo,
        sessions: d.sessions.map(({ src, tool, start, end, min, cost, tokens, how }) => ({ src, tool, start, end, min, cost, tokens, how })),
      })),
    }),
  );
  const skipped = trace.flatMap((t) => t.days.filter((d) => !d.counted && d.cell.tot > 0));
  // 미배정 세션은 어느 요구사항인지 모르므로 범위 안 담당자의 것을 모두 보여 준다.
  const owners = new Set(units.map((u) => u.ownerId));
  const pend = ix.alloc.pending.filter((p) => owners.has(p.session.userId));
  return {
    filter,
    total: aggTrace(ix, trace),
    settings: { mdHours: s.mdHours, gradePrice: s.gradePrice, tokenPrice: s.tokenPrice },

    units: vm,
    excluded: { days: skipped.length, hours: skipped.reduce((a, d) => a + d.cell.tot, 0) },
    pending: { n: pend.length, hours: pend.reduce((a, p) => a + p.session.minutes, 0) / 60 },
    offCount: ix.alloc.offCount,
  };
}

// ---------- 공수 모니터링 ----------
export interface MonitorVM {
  today: string;
  items: (Anomaly & { userNm: string; last: MonitorNote | null; notes: MonitorNote[] })[];
  free: MonitorNote[];
  users: { userId: string; userNm: string }[];
}

export function monitorView(ix: Index, users: UserRecord[], notes: MonitorNote[], today: string): MonitorVM {
  const names = new Map(users.map((u) => [u.userId, u.userNm]));
  const byKey = new Map<string, MonitorNote[]>();
  notes.forEach((n) => byKey.set(n.key, [...(byKey.get(n.key) ?? []), n]));
  return {
    today,
    items: detectAnomalies(ix, names, today).map((a) => {
      const ns = byKey.get(a.key) ?? [];
      return { ...a, userNm: a.userId ? (names.get(a.userId) ?? a.userId) : "", last: ns[0] ?? null, notes: ns };
    }),
    free: byKey.get("FREE") ?? [],
    users: users.filter((u) => u.role === "DEVELOPER").map((u) => ({ userId: u.userId, userNm: u.userNm })),
  };
}
