// 화면별로 서버가 내려줄 직렬화 가능한 데이터. 숫자 계산은 measure/metrics.ts 를 부르기만 한다.
import { canSee, type Actor } from "./auth/permissions";
import { DIMS, catsOf, dimValues, type DimKey } from "./dims";
import { aggTrace, aggUnits, cellOf, metricDefs, nextDayConfRate, pendingOf, sessionCost, tagRate, traceUnits, reqStatus, rowsOf, stageStatus, unitsOfReq, type Agg, type Cell, type Index, type MetricDef, type Ratio, type ReqStatus, type RowSt } from "./measure/metrics";
import { detectAnomalies, type Anomaly } from "./measure/monitor";
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
    stages: ix.units
      .filter((u) => u.req === req)
      .map((u) => ({
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

/** 단계 띠 한 칸 — 태그 없음 / 남의 단계 / 내 단계 */
export interface StageBoxVM {
  cd: StageCd;
  who: "none" | "other" | "mine";
  code: string;
  workType: string;
  ownerNm: string;
  status: ReqStatus;
  done: boolean;
  md: number;
  baseMd: number;
}

export type EffortCellVM = CellVM & { unit: string; done: boolean };

export interface EffortRowVM {
  date: string;
  st: RowSt;
  revCount: number;
  cells: Partial<Record<StageCd, EffortCellVM>>;
  tot: number;
}

/** 공수 입력 화면의 요구사항 하나 — 일자 × 단계 */
export interface EffortReqVM {
  rk: string;
  reqId: string;
  name: string;
  prjId: string;
  prjNm: string;
  sysNm: string;
  teamNm: string;
  status: ReqStatus;
  md: number;
  baseMd: number;
  inT: number;
  out: number;
  need: number;
  strip: StageBoxVM[];
  /** 입력 칸이 열리는 단계(내 담당) */
  mine: StageCd[];
  /** 세션 첫 줄에 넣을 내 단계 코드 — 측정 완료 단계는 뺀다 */
  codes: string[];
  rows: EffortRowVM[];
  /** 확정된 날 단계별 합(h) */
  confSum: Partial<Record<StageCd, number>>;
  confDays: number;
}

export interface EffortVM {
  userId: string;
  userNm: string;
  devs: { userId: string; userNm: string }[];
  today: string;
  mdHours: number;
  reqs: EffortReqVM[];
  pending: PendingVM[];
}

const cellVM = (c: Cell): CellVM => ({ ai: c.ai, mn: c.mn, inT: c.inT, out: c.out, tot: c.tot, add: c.add, memo: c.memo });

export function effortView(ix: Index, users: UserRecord[], userId: string, today: string): EffortVM {
  const devs = users.filter((u) => u.role === "DEVELOPER" && u.useYn).map((u) => ({ userId: u.userId, userNm: u.userNm }));
  const mineUnits = ix.units.filter((u) => u.ownerId === userId);
  const byReq = new Map<Requirement, Unit[]>();
  mineUnits.forEach((u) => byReq.set(u.req, [...(byReq.get(u.req) ?? []), u]));

  const reqs = Array.from(byReq, ([req, us]): EffortReqVM => {
    const prj = us[0].prj;
    const strip = STAGES.map((cd): StageBoxVM => {
      const s = req.stages.find((x) => x.cd === cd);
      const u = s && unitsOfReq(ix, req).find((x) => x.stage === cd);
      return {
        cd,
        who: !s ? "none" : s.ownerId === userId ? "mine" : "other",
        code: u?.code ?? "",
        workType: s?.workType ?? "",
        ownerNm: s ? s.ownerNm || s.ownerId || "미지정" : "",
        status: stageStatus(ix, req, cd),
        done: !!s?.done,
        md: u ? aggUnits(ix, [u], false).md : 0,
        baseMd: s?.baseMd ?? 0,
      };
    });
    const rows = rowsOf(ix, userId, req).map((r): EffortRowVM => {
      const cells: Partial<Record<StageCd, EffortCellVM>> = {};
      for (const u of us) cells[u.stage] = { ...cellVM(cellOf(ix, u.code, r.date)), unit: u.code, done: u.s.done };
      return { date: r.date, st: r.st, revCount: r.revCount, cells, tot: Object.values(cells).reduce((a, c) => a + (c?.tot ?? 0), 0) };
    });
    const confRows = rows.filter((r) => r.st === "conf");
    const confSum: Partial<Record<StageCd, number>> = {};
    for (const u of us) confSum[u.stage] = confRows.reduce((a, r) => a + (r.cells[u.stage]?.tot ?? 0), 0);
    const a = aggUnits(ix, us, false);
    return {
      rk: us[0].reqKey,
      reqId: req.reqId,
      name: req.name && req.name !== req.reqId ? req.name : "",
      prjId: prj.prjId,
      prjNm: prj.prjNm,
      sysNm: prj.sysNm,
      teamNm: prj.teamNm,
      status: reqStatus(ix, req),
      md: a.md,
      baseMd: us.reduce((x, u) => x + u.s.baseMd, 0),
      inT: a.inT,
      out: a.out,
      need: rows.filter((r) => r.st !== "conf").length,
      strip,
      mine: us.map((u) => u.stage),
      codes: us.filter((u) => !u.s.done).map((u) => u.code),
      rows,
      confSum,
      confDays: confRows.length,
    };
  });

  const label = (code: string) => {
    const u = ix.unitByCode.get(code);
    return u ? `${code} · ${reqLabel(u.req)} · ${STAGE_LABEL[u.stage]}` : code;
  };
  const open = mineUnits.filter((u) => !u.s.done).map((u) => u.code);
  const pending = pendingOf(ix, userId)
    .sort((x, y) => x.session.workDt.localeCompare(y.session.workDt))
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
  return {
    userId,
    userNm: users.find((u) => u.userId === userId)?.userNm ?? userId,
    devs,
    today,
    mdHours: ix.data.settings.mdHours,
    reqs,
    pending,
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
  projects: { prjId: string; prjNm: string; doneN: number; reqN: number; agg: Agg }[];
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
    .map((x) => ({
      prjId: x.p.prjId,
      prjNm: x.p.prjNm,
      doneN: x.reqs.filter((r) => reqDone(r)).length,
      reqN: x.reqs.length,
      agg: agg(units.filter((u) => u.prj === x.p)),
    }));
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
      const reqs = ix.data.projects.flatMap((p) => p.reqs).filter((r) => r.stages.some((s) => s.ownerId === d.userId));
      const rowsBy = reqs.map((r) => rowsOf(ix, d.userId, r));
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
  const pend = new Set(ix.alloc.pending.map((p) => p.session.datId));
  const map = new Map<string, CollectRowVM>();
  for (const s of ix.data.sessions) {
    const k = `${s.userId}|${s.workDt}|${s.src}`;
    const r = map.get(k) ?? {
      userId: s.userId,
      userNm: users.find((u) => u.userId === s.userId)?.userNm ?? s.userId,
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
      ix.units
        .filter((u) => reqs.includes(u.req))
        .map((u) => ({
          prjId: u.prjId,
          reqId: u.code,
          name: reqLabel(u.req),
          baseMd: u.s.baseMd,
          status: stageStatus(ix, u.req, u.stage),
          values: formValues(u.prj, u.req, u.s, u.code),
        })),
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
