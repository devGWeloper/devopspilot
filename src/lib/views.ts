// 화면별로 서버가 내려줄 직렬화 가능한 데이터. 숫자 계산은 measure/metrics.ts 를 부르기만 한다.
import { canSee, type Actor } from "./auth/permissions";
import { aggUnits, cellOf, confirmedSum, needCount, pendingOf, reqStatus, rowsOf, stageStatus, unitsOfReq, type Agg, type Index, type ReqStatus, type RowSt } from "./measure/metrics";
import type { ActType } from "./measure/types";
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

// ---------- 투입 공수 ----------
export interface CellVM {
  ai: number;
  mn: number;
  inT: number;
  out: number;
  tot: number;
  add: Partial<Record<ActType, number>>;
  memo: string;
}

export interface DayRowVM {
  date: string;
  st: RowSt;
  revCount: number;
  changed: boolean;
  cells: Partial<Record<StageCd, CellVM>>;
  tot: number;
}

export interface OwnerVM {
  userId: string;
  userNm: string;
  stages: StageCd[];
  rows: DayRowVM[];
  need: number;
  conf: { byStage: Partial<Record<StageCd, number>>; tot: number; md: number };
}

export interface EffortReqVM extends ReqVM {
  prjNm: string;
  kind: PrjKind;
  sysNm: string;
  teamNm: string;
  owners: OwnerVM[];
}

export interface PendingVM {
  datId: string;
  userId: string;
  userNm: string;
  date: string;
  start: string;
  end: string;
  minutes: number;
  tool: string;
  branch: string;
  why: string;
  cands: { code: string; label: string }[];
  options: { code: string; label: string }[];
}

export interface EffortVM {
  reqs: EffortReqVM[];
  pending: PendingVM[];
  offCount: number;
}

export function effortView(ix: Index, actor: Actor, users: UserRecord[]): EffortVM {
  const nm = (id: string) => users.find((u) => u.userId === id)?.userNm ?? id;
  const label = (code: string) => {
    const u = ix.unitByCode.get(code);
    return u ? `${u.req.name} · ${STAGE_LABEL[u.stage]}` : code;
  };
  const reqs: EffortReqVM[] = [];
  for (const p of ix.data.projects) {
    for (const r of p.reqs) {
      if (!canSee(actor, r)) continue;
      const ownerIds = Array.from(new Set(r.stages.map((s) => s.ownerId).filter((x): x is string => !!x)));
      const owners = ownerIds
        .filter((id) => actor.role !== "DEVELOPER" || id === actor.userId)
        .map((userId): OwnerVM => {
          const stages = r.stages.filter((s) => s.ownerId === userId).map((s) => s.cd);
          const rows = rowsOf(ix, userId, r).map((row): DayRowVM => {
            const cells: DayRowVM["cells"] = {};
            let tot = 0;
            for (const cd of stages) {
              const c = cellOf(ix, `${r.reqId}-${cd}`, row.date);
              cells[cd] = { ai: c.ai, mn: c.mn, inT: c.inT, out: c.out, tot: c.tot, add: c.add, memo: c.memo };
              tot += c.tot;
            }
            return { ...row, cells, tot };
          });
          return { userId, userNm: nm(userId), stages, rows, need: needCount(ix, userId, r), conf: confirmedSum(ix, userId, r) };
        });
      reqs.push({ ...reqVM(ix, p, r), prjNm: p.prjNm, kind: p.kind, sysNm: p.sysNm, teamNm: p.teamNm, owners });
    }
  }
  const openUnits = (userId: string) => ix.units.filter((u) => u.ownerId === userId && !u.req.done).map((u) => u.code);
  const pending = pendingOf(ix, actor.role === "DEVELOPER" ? actor.userId : null).map(
    (p): PendingVM => ({
      datId: p.session.datId,
      userId: p.session.userId,
      userNm: nm(p.session.userId),
      date: p.session.workDt,
      start: p.session.start,
      end: p.session.end,
      minutes: p.session.minutes,
      tool: p.session.tool,
      branch: p.session.branch,
      why: p.why,
      cands: p.cands.map((code) => ({ code, label: label(code) })),
      options: openUnits(p.session.userId).map((code) => ({ code, label: label(code) })),
    }),
  );
  return { reqs, pending, offCount: ix.alloc.offCount };
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
  reqs: { reqId: string; name: string; prjNm: string; status: ReqStatus; grade: string; agg: Agg }[];
  settings: { mdHours: number; gradePrice: Record<string, number> };
}

export function dashView(ix: Index, actor: Actor, filter: DashFilter): DashVM {
  const visible = ix.data.projects.map((p) => ({ p, reqs: p.reqs.filter((r) => canSee(actor, r)) })).filter((x) => x.reqs.length);
  const projectOptions = visible
    .filter((x) => !filter.kind || x.p.kind === filter.kind)
    .map((x) => ({ prjId: x.p.prjId, prjNm: x.p.prjNm, kind: x.p.kind }));
  const inScope = (p: Project, r: Requirement) =>
    (!filter.kind || p.kind === filter.kind) && (!filter.prjId || p.prjId === filter.prjId) && (r.done || (filter.includeIng && reqStatus(ix, r) === "ING"));
  const reqSet = new Set(visible.flatMap((x) => x.reqs.filter((r) => inScope(x.p, r))));
  const units = ix.units.filter((u) => reqSet.has(u.req));
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
      .map((r) => ({ reqId: r.reqId, name: r.name, prjNm: x.p.prjNm, status: reqStatus(ix, r), grade: r.grade, agg: agg(units.filter((u) => u.req === r)) })),
  );
  return {
    filter,
    projectOptions,
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
