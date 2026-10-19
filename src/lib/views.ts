// 화면별로 서버가 내려줄 직렬화 가능한 데이터. 숫자 계산은 measure/metrics.ts 를 부르기만 한다.
import { canSee, type Actor } from "./auth/permissions";
import { DIMS, catsOf, dimValues, type DimKey } from "./dims";
import { aggTrace, aggUnits, cellOf, needCount, pendingOf, traceUnits, reqStatus, rowsOf, stageStatus, unitsOfReq, userDates, userDayState, userDayTotal, type Agg, type DaySt, type Index, type ReqStatus } from "./measure/metrics";
import { detectAnomalies, type Anomaly } from "./measure/monitor";
import type { ActType, MonitorNote } from "./measure/types";
import { reqBaseMd } from "./measure/units";
import { STAGE_LABEL, STAGES, type PrjKind, type Project, type Requirement, type StageCd, type UserRecord } from "./types";

export type ProjectInfo = Omit<Project, "reqs">;

export interface StageVM {
  cd: StageCd;
  workType: string;
  ownerId: string | null;
  ownerNm: string;
  baseMd: number;
  md: number;
  status: ReqStatus;
}

export interface ReqVM {
  prjId: string;
  reqId: string;
  name: string;
  difficulty: string;
  grade: string;
  baseSrc: string;
  done: boolean;
  status: ReqStatus;
  baseMd: number;
  md: number;
  inT: number;
  out: number;
  stages: StageVM[];
  extra: Record<string, string>;
}

function reqVM(ix: Index, prj: Project, req: Requirement): ReqVM {
  const a = aggUnits(ix, unitsOfReq(ix, req), false);
  return {
    prjId: prj.prjId,
    reqId: req.reqId,
    name: req.name,
    difficulty: req.difficulty,
    grade: req.grade,
    baseSrc: req.baseSrc,
    done: req.done,
    status: reqStatus(ix, req),
    baseMd: reqBaseMd(req),
    md: a.md,
    inT: a.inT,
    out: a.out,
    extra: req.extra,
    stages: req.stages.map((s) => ({
      cd: s.cd,
      workType: s.workType,
      ownerId: s.ownerId,
      ownerNm: s.ownerNm || s.ownerId || "미지정",
      baseMd: s.baseMd,
      md: aggUnits(ix, ix.units.filter((u) => u.req === req && u.stage === s.cd), false).md,
      status: stageStatus(ix, req, s.cd),
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

export interface DayItemVM {
  date: string;
  st: DaySt;
  hours: number;
  pending: number;
}

export interface DayLineVM {
  unit: string;
  prjId: string;
  prjNm: string;
  reqId: string;
  reqName: string;
  stage: StageCd;
  workType: string;
  done: boolean;
  cell: CellVM;
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

export interface EffortDayVM {
  userId: string;
  userNm: string;
  devs: { userId: string; userNm: string }[];
  date: string;
  today: string;
  days: DayItemVM[];
  st: DaySt;
  total: number;
  lines: DayLineVM[];
  pending: PendingVM[];
  pendingAll: number;
  mine: MyReqVM[];
}

/** 날짜와 무관하게 내가 맡은 요구사항이 어디까지 왔는지 */
export interface MyReqVM {
  reqId: string;
  prjId: string;
  name: string;
  prjNm: string;
  stages: StageCd[];
  status: ReqStatus;
  need: number;
  md: number;
  baseMd: number;
}

/** 측정 시작일 ~ 오늘 평일 + 기록 있는 날 (최근 순) */
function dayList(start: string, today: string, extra: string[]): string[] {
  const out = new Set(extra.filter((d) => d <= today));
  const t = new Date(today + "T00:00:00Z");
  for (let i = 0; i < 90; i++) {
    const d = new Date(t.getTime() - i * 86400000);
    const ymd = d.toISOString().slice(0, 10);
    if (ymd < start) break;
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.add(ymd);
  }
  return Array.from(out).sort((a, b) => b.localeCompare(a));
}

export function effortDayView(ix: Index, users: UserRecord[], userId: string, date: string | null, today: string): EffortDayVM {
  const devs = users.filter((u) => u.role === "DEVELOPER" && u.useYn).map((u) => ({ userId: u.userId, userNm: u.userNm }));
  const pendingMine = pendingOf(ix, userId);
  const dates = dayList(ix.data.settings.measureStart, today, [...userDates(ix, userId), ...pendingMine.map((p) => p.session.workDt)]);
  const days = dates.map((d) => ({
    date: d,
    st: userDayState(ix, userId, d),
    hours: userDayTotal(ix, userId, d),
    pending: pendingMine.filter((p) => p.session.workDt === d).length,
  }));
  // 날짜를 안 고르면 확정이 밀린 가장 오래된 날, 없으면 오늘
  const firstNeed = [...days].reverse().find((d) => d.st === "need" || d.st === "edit" || d.pending > 0);
  const sel = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today ? date : (firstNeed?.date ?? today);

  const label = (code: string) => {
    const u = ix.unitByCode.get(code);
    return u ? `${u.req.name} · ${STAGE_LABEL[u.stage]}` : code;
  };
  const lines = ix.units
    .filter((u) => u.ownerId === userId)
    .map((u) => ({ u, cell: cellOf(ix, u.code, sel) }))
    .filter(({ u, cell }) => !u.req.done || cell.tot > 0 || cell.ai > 0)
    .map(
      ({ u, cell }): DayLineVM => ({
        unit: u.code,
        prjId: u.prj.prjId,
        prjNm: u.prj.prjNm,
        reqId: u.reqId,
        reqName: u.req.name,
        stage: u.stage,
        workType: u.s.workType,
        done: u.req.done,
        cell: { ai: cell.ai, mn: cell.mn, inT: cell.inT, out: cell.out, tot: cell.tot, add: cell.add, memo: cell.memo },
      }),
    );
  const open = ix.units.filter((u) => u.ownerId === userId && !u.req.done).map((u) => u.code);
  const pending = pendingMine
    .filter((p) => p.session.workDt === sel)
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
    date: sel,
    today,
    days,
    st: userDayState(ix, userId, sel),
    total: userDayTotal(ix, userId, sel),
    lines,
    pending,
    pendingAll: pendingMine.length,
    mine: myReqs(ix, userId),
  };
}

function myReqs(ix: Index, userId: string): MyReqVM[] {
  const by = new Map<Requirement, Index["units"]>();
  ix.units.filter((u) => u.ownerId === userId).forEach((u) => by.set(u.req, [...(by.get(u.req) ?? []), u]));
  return Array.from(by, ([req, us]) => ({
    reqId: req.reqId,
    prjId: us[0].prj.prjId,
    name: req.name,
    prjNm: us[0].prj.prjNm,
    stages: us.map((u) => u.stage),
    status: reqStatus(ix, req),
    need: needCount(ix, userId, req),
    md: aggUnits(ix, us, false).md,
    baseMd: us.reduce((a, u) => a + u.s.baseMd, 0),
  }));
}

// ---------- 측정 결과 ----------
export interface DashFilter {
  kind: PrjKind | "";
  prjId: string;
  includeIng: boolean;
}

export interface DashVM {
  filter: DashFilter;
  projectOptions: { prjId: string; prjNm: string; kind: PrjKind }[];
  total: Agg;
  stages: { cd: StageCd; agg: Agg; workTypes: { workType: string; agg: Agg }[] }[];
  projects: { prjId: string; prjNm: string; kind: PrjKind; doneN: number; reqN: number; agg: Agg }[];
  reqs: { reqId: string; name: string; prjId: string; prjNm: string; status: ReqStatus; grade: string; agg: Agg }[];
  /** 과제 성격(분류 축)별 결과 */
  byDim: { key: DimKey; title: string; rows: { cat: string; reqN: number; agg: Agg }[] }[];
  settings: { mdHours: number; gradePrice: Record<string, number> };
}

/** 측정 결과·산출 근거가 같은 범위를 쓰도록 */
function scopeOf(ix: Index, actor: Actor, filter: DashFilter) {
  const visible = ix.data.projects.map((p) => ({ p, reqs: p.reqs.filter((r) => canSee(actor, r)) })).filter((x) => x.reqs.length);
  const inScope = (p: Project, r: Requirement) =>
    (!filter.kind || p.kind === filter.kind) && (!filter.prjId || p.prjId === filter.prjId) && (r.done || (filter.includeIng && reqStatus(ix, r) === "ING"));
  const reqSet = new Set(visible.flatMap((x) => x.reqs.filter((r) => inScope(x.p, r))));
  return { visible, reqSet, units: ix.units.filter((u) => reqSet.has(u.req)) };
}

export function dashView(ix: Index, actor: Actor, filter: DashFilter): DashVM {
  const { visible, reqSet, units } = scopeOf(ix, actor, filter);
  const projectOptions = visible
    .filter((x) => !filter.kind || x.p.kind === filter.kind)
    .map((x) => ({ prjId: x.p.prjId, prjNm: x.p.prjNm, kind: x.p.kind }));
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
      kind: x.p.kind,
      doneN: x.reqs.filter((r) => r.done).length,
      reqN: x.reqs.length,
      agg: agg(units.filter((u) => u.prj === x.p)),
    }));
  const reqs = visible.flatMap((x) =>
    x.reqs
      .filter((r) => reqSet.has(r))
      .map((r) => ({ reqId: r.reqId, name: r.name, prjId: x.p.prjId, prjNm: x.p.prjNm, status: reqStatus(ix, r), grade: r.grade, agg: agg(units.filter((u) => u.req === r)) })),
  );
  const vals = new Map(units.map((u) => [u.req, dimValues(u.prj, u.req)]));
  const byDim = DIMS.map((d) => {
    const seen = Array.from(vals.values()).map((v) => v[d.key]);
    return {
      key: d.key,
      title: d.title,
      rows: catsOf(d, seen)
        .map((cat) => {
          const us = units.filter((u) => vals.get(u.req)?.[d.key] === cat);
          return { cat, reqN: new Set(us.map((u) => u.req)).size, agg: agg(us) };
        })
        .concat(
          seen.some((v) => !v)
            ? [(() => {
                const us = units.filter((u) => !vals.get(u.req)?.[d.key]);
                return { cat: "미입력", reqN: new Set(us.map((u) => u.req)).size, agg: agg(us) };
              })()]
            : [],
        ),
    };
  });
  return {
    filter,
    projectOptions,
    byDim,
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
  rows: { userId: string; userNm: string; cells: (number | null)[]; rate: number | null }[];
}

/** 개발자 × 일자 — 숫자 = 확정 필요 요구사항 수, 0 = 모두 확정, null = 입력 없음 */
export function confMatrix(ix: Index, users: UserRecord[], days: string[]): ConfMatrixVM {
  const devs = users.filter((u) => u.role === "DEVELOPER" && u.useYn);
  return {
    days,
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
      return { userId: d.userId, userNm: d.userNm, cells, rate: tot ? ok / tot : null };
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
    };
    r.sessions++;
    r.minutes += s.minutes;
    if (pend.has(s.datId)) r.pending++;
    map.set(k, r);
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date) || a.userNm.localeCompare(b.userNm));
}

// ---------- 과제 선정 현황 (Phase 1 결과 분포) ----------
export interface SelReqVM {
  prjId: string;
  reqId: string;
  name: string;
  baseMd: number;
  status: ReqStatus;
  fitRef: string;
  dims: Record<DimKey, string>;
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
    reqs: visible.flatMap(({ p, reqs }) =>
      reqs.map((r) => ({
        prjId: p.prjId,
        reqId: r.reqId,
        name: r.name,
        baseMd: reqBaseMd(r),
        status: reqStatus(ix, r),
        fitRef: r.extra["FIT-05"] ?? "",
        dims: dimValues(p, r),
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
  add: Partial<Record<ActType, number>>;
  memo: string;
  sessions: { src: string; tool: string; start: string; end: string; min: number; cost: number; how: string }[];
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
  settings: { mdHours: number; gradePrice: Record<string, number>; aiRate: Record<string, number>; defaultAiRate: number };
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
      reqName: t.unit.req.name,
      stage: t.unit.stage,
      ownerNm: t.unit.s.ownerNm || t.unit.ownerId || "미지정",
      grade: t.unit.req.grade,
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
        add: d.cell.add,
        memo: d.cell.memo,
        sessions: d.sessions.map(({ src, tool, start, end, min, cost, how }) => ({ src, tool, start, end, min, cost, how })),
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
    settings: { mdHours: s.mdHours, gradePrice: s.gradePrice, aiRate: s.aiRate, defaultAiRate: s.defaultAiRate },
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
