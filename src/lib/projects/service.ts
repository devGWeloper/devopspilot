import { randomBytes } from "crypto";
import { hashPassword } from "../auth/password";
import { can, type ActorFull } from "../auth/permissions";
import { record } from "../history";
import { normalizeSettings, SETTINGS_KEY } from "../measure/defaults";
import { metricDefs } from "../measure/metrics";
import { getSettings, loadIndex } from "../measure/service";
import { stageStatus } from "../measure/metrics";
import type { Settings } from "../measure/types";
import { reqKey, unitCode } from "../measure/units";
import { conflictR, err, forbiddenR, notFoundR, okR, type ServiceResult } from "../result";
import type { Store } from "../store/types";
import { STAGES, type Project, type Requirement, type Stage, type UserRecord } from "../types";
import { buildWorkbook, parseWorkbook, readWorkbookGrids, workbookTables, type WbError, type WorkbookData } from "./workbook";

const PRJ_ID_RE = /^[A-Za-z0-9_]{1,20}$/;

function emptyProject(prjId: string, prjNm: string, actor: ActorFull, now: string): Project {
  return {
    prjId,
    prjNm,
    promisCd: "",
    sysNm: "",
    deptCd: "",
    teamNm: "",
    axHq: "",
    axTeam: "",
    pmNm: "",
    sysGrade: "",
    deployType: "",
    area: "",
    vcs: "",
    pms: "",
    reqs: [],
    regUserId: actor.userId,
    regAt: now,
    updUserId: actor.userId,
    updAt: now,
  };
}

const emptyStage = (cd: Stage["cd"]): Stage => ({
  cd,
  workType: "",
  ownerId: null,
  ownerNm: "",
  baseMd: 0,
  difficulty: "",
  grade: "",
  baseSrc: "",
  done: false,
  doneAt: null,
  fit: "",
  spec: "",
  ctx: "",
  gen: "",
});

// ---------- 기준정보 엑셀 ----------

export interface ImportSummary {
  projectsNew: number;
  projectsUpdated: number;
  tagsNew: number;
  tagsUpdated: number;
  mapped: number;
  usersNew: number;
  usersUpdated: number;
  grades: number;
  tokens: number;
  /** 새로 만든 계정의 초기 비밀번호 — 이 응답에서만 보여 준다 */
  newPasswords: { userId: string; userNm: string; password: string }[];
}

/** 파일에 있는 행은 파일 값으로, 없는 행은 그대로 둔다(삭제는 화면에서). */
export function mergeWorkbook(projects: Project[], users: UserRecord[], d: WorkbookData, actor: ActorFull, now: string) {
  const out = projects.map((p) => structuredClone(p));
  const changed = new Set<string>();
  const s = { projectsNew: 0, projectsUpdated: 0, tagsNew: 0, tagsUpdated: 0, mapped: 0 };
  for (const r of d.projects) {
    let p = out.find((x) => x.prjId === r.prjId);
    if (!p) {
      p = emptyProject(r.prjId, r.prjNm, actor, now);
      out.push(p);
      s.projectsNew++;
    } else s.projectsUpdated++;
    const { rowNo: _n, ...v } = r;
    Object.assign(p, v);
    changed.add(p.prjId);
  }
  const nameOf = new Map([...users.map((u) => [u.userId, u.userNm] as const), ...d.devs.map((u) => [u.userId, u.userNm] as const)]);
  const findStage = (tag: string) => {
    for (const p of out) for (const r of p.reqs) for (const st of r.stages) if (unitCode(p.prjId, r.reqId, st.cd) === tag) return { p, r, st };
    return null;
  };
  for (const t of d.tags) {
    const p = out.find((x) => x.prjId === t.prjId)!;
    let req = p.reqs.find((x) => x.reqId === t.reqId);
    if (!req) {
      req = { reqId: t.reqId, name: "", stages: [] };
      p.reqs.push(req);
    }
    if (t.name !== null) req.name = t.name;
    let st = req.stages.find((x) => x.cd === t.stage);
    if (!st) {
      st = emptyStage(t.stage);
      req.stages.push(st);
      req.stages.sort((a, b) => STAGES.indexOf(a.cd) - STAGES.indexOf(b.cd));
      s.tagsNew++;
    } else s.tagsUpdated++;
    Object.assign(st, {
      difficulty: t.difficulty,
      grade: t.grade,
      baseMd: t.baseMd,
      baseSrc: t.baseSrc,
      done: t.done,
      doneAt: t.done ? (t.doneAt ?? st.doneAt ?? now.slice(0, 10)) : null,
      fit: t.fit,
      spec: t.spec,
      ctx: t.ctx,
      gen: t.gen,
      ...(t.workType !== null ? { workType: t.workType } : {}),
    });
    changed.add(p.prjId);
  }
  for (const m of d.mapping) {
    const f = findStage(m.tag);
    if (!f) continue;
    f.st.ownerId = m.userId || null;
    f.st.ownerNm = m.userId ? (nameOf.get(m.userId) ?? m.userId) : "";
    s.mapped++;
    changed.add(f.p.prjId);
  }
  for (const p of out) if (changed.has(p.prjId)) Object.assign(p, { updUserId: actor.userId });
  return { projects: out, changed, summary: s };
}

function newPassword() {
  return randomBytes(9).toString("base64url").slice(0, 10) + "!";
}

export async function importWorkbook(store: Store, actor: ActorFull, buf: ArrayBuffer): Promise<ServiceResult<ImportSummary>> {
  if (!can(actor, "project.manage")) return forbiddenR();
  let grids: Awaited<ReturnType<typeof readWorkbookGrids>>;
  try {
    grids = await readWorkbookGrids(buf);
  } catch {
    return err(400, "BAD_FILE", "엑셀 파일을 읽지 못했습니다. .xlsx 파일인지 확인해 주세요.");
  }
  if (!Object.keys(grids).length) return err(400, "NO_SHEET", "'01. 과제' ~ '04. 기준정보' 시트를 찾지 못했습니다. 포털에서 내려받은 양식을 써 주세요.");

  const [before, users, settings] = await Promise.all([store.projects.list(), store.users.list(), getSettings(store)]);
  const known = {
    prjIds: new Set(before.map((p) => p.prjId)),
    tags: new Set(before.flatMap((p) => p.reqs.flatMap((r) => r.stages.map((s) => unitCode(p.prjId, r.reqId, s.cd))))),
    userIds: new Set(users.map((u) => u.userId)),
  };
  const { data, errors } = parseWorkbook(grids, known);
  const fileIds = new Set(data.devs.map((x) => x.userId));
  // 파일에 없는 계정과 AI 도구 계정이 겹치거나, 관리자가 한 명도 안 남게 되는 경우도 저장 전에 막는다.
  for (const dv of data.devs) {
    const clash = users.find((u) => !fileIds.has(u.userId) && dv.aiAcct && u.aiAcct.toLowerCase() === dv.aiAcct.toLowerCase());
    if (clash) errors.push({ sheet: "03. 공수 태그 매핑", rowNo: dv.rowNo, message: `AI 도구 계정 ${dv.aiAcct} 은(는) 이미 ${clash.userNm}(${clash.userId}) 계정에 있습니다.` });
  }
  const finalRole = new Map(users.filter((u) => u.useYn).map((u) => [u.userId, u.role]));
  data.devs.forEach((x) => finalRole.set(x.userId, x.role));
  if (!Array.from(finalRole.values()).includes("ADMIN"))
    errors.push({ sheet: "03. 공수 태그 매핑", rowNo: 0, message: "관리자 권한 계정이 하나도 남지 않습니다." });
  const total = data.projects.length + data.tags.length + data.mapping.length + data.devs.length + data.grades.length + data.tokens.length;
  if (!errors.length && total === 0) return err(400, "EMPTY", "올릴 행이 없습니다.");
  if (errors.length) return err(400, "INVALID_ROWS", `${errors.length}개 행에 오류가 있어 아무것도 저장하지 않았습니다.`, errors);

  const now = new Date().toISOString();
  const summary: ImportSummary = { projectsNew: 0, projectsUpdated: 0, tagsNew: 0, tagsUpdated: 0, mapped: 0, usersNew: 0, usersUpdated: 0, grades: data.grades.length, tokens: data.tokens.length, newPasswords: [] };

  // 계정 먼저 — 매핑된 담당 이름을 계정 이름으로 맞추려고
  for (const dv of data.devs) {
    const cur = users.find((u) => u.userId === dv.userId);
    const fields = { userNm: dv.userNm, hqNm: dv.hqNm, deptNm: dv.deptNm, role: dv.role, aiAcct: dv.aiAcct };
    if (cur) {
      await store.users.update(dv.userId, { ...fields, updAt: now });
      summary.usersUpdated++;
    } else {
      const password = newPassword();
      const { hash, salt } = hashPassword(password);
      await store.users.insert({ userId: dv.userId, ...fields, orgCd: "SKAX", useYn: true, pwdHash: hash, pwdSalt: salt, lastLoginAt: null, regAt: now, updAt: now });
      summary.usersNew++;
      summary.newPasswords.push({ userId: dv.userId, userNm: dv.userNm, password });
    }
  }

  const merged = mergeWorkbook(before, users, data, actor, now);
  Object.assign(summary, merged.summary);
  for (const p of merged.projects) {
    if (!merged.changed.has(p.prjId)) continue;
    const prev = before.find((x) => x.prjId === p.prjId);
    const next = { ...p, updAt: now };
    if (!prev) await store.projects.insert(next);
    else if (!(await store.projects.update(next, prev.updAt))) return conflictR();
  }

  if (data.grades.length || data.tokens.length) {
    const next: Settings = normalizeSettings({
      ...settings,
      ...(data.grades.length
        ? { gradePrice: Object.fromEntries(data.grades.map((g) => [g.grade, g.md])), gradePriceMm: Object.fromEntries(data.grades.map((g) => [g.grade, g.mm])) }
        : {}),
      ...(data.tokens.length ? { tokenPrice: Object.fromEntries(data.tokens.map((t) => [t.model, { input: t.input, cached: t.cached, output: t.output }])) } : {}),
    });
    const prev = await store.config.get<Settings>(SETTINGS_KEY);
    await store.config.set(SETTINGS_KEY, next, (prev?.verNo ?? 0) + 1, actor.userId);
  }

  await record(store, actor, {
    targetTyp: "PROJECT",
    targetId: "IMPORT",
    actionCd: "IMPORT",
    summary: `기준정보 엑셀: 과제 신규 ${summary.projectsNew}·갱신 ${summary.projectsUpdated}, 요구사항·단계 신규 ${summary.tagsNew}·갱신 ${summary.tagsUpdated}, 매핑 ${summary.mapped}, 계정 신규 ${summary.usersNew}·갱신 ${summary.usersUpdated}, 등급 단가 ${summary.grades}, 토큰 단가 ${summary.tokens}`,
  });
  return okR(summary);
}

export async function exportWorkbook(store: Store, actor: ActorFull): Promise<ServiceResult<ArrayBuffer>> {
  if (!can(actor, "project.manage")) return forbiddenR();
  const ix = await loadIndex(store);
  const users = await store.users.list();
  const byCode = new Map(ix.units.map((u) => [u.code, u]));
  const tables = workbookTables(ix.data.projects, users, ix.data.settings, metricDefs(ix.data.settings.mdHours), (code) => {
    const u = byCode.get(code);
    return u ? stageStatus(ix, u.req, u.stage) : "WAIT";
  });
  return okR(await buildWorkbook(tables));
}

export type { WbError };

// ---------- 화면 편집 ----------

export interface ProjectPatch {
  prjId?: string;
  prjNm: string;
  promisCd?: string;
  sysNm: string;
  deptCd: string;
  teamNm: string;
  axHq?: string;
  axTeam: string;
  pmNm: string;
  sysGrade?: string;
  deployType?: string;
  area?: string;
  vcs?: string;
  pms?: string;
}

const PATCH_KEYS = ["prjNm", "promisCd", "sysNm", "deptCd", "teamNm", "axHq", "axTeam", "pmNm", "sysGrade", "deployType", "area", "vcs", "pms"] as const;

function applyPatch(p: Project, patch: ProjectPatch) {
  for (const k of PATCH_KEYS) {
    const v = patch[k];
    if (v !== undefined) (p as unknown as Record<string, string>)[k] = String(v).trim();
  }
}

async function mutateProject(
  store: Store,
  actor: ActorFull,
  prjId: string,
  expectedUpdAt: string,
  fn: (p: Project) => ServiceResult<string>,
): Promise<ServiceResult<Project>> {
  if (!can(actor, "project.manage")) return forbiddenR();
  const cur = await store.projects.get(prjId);
  if (!cur) return notFoundR("과제");
  if (cur.updAt !== expectedUpdAt) return conflictR();
  const next = structuredClone(cur);
  const r = fn(next);
  if (!r.ok) return r;
  next.updAt = new Date().toISOString();
  next.updUserId = actor.userId;
  if (!(await store.projects.update(next, expectedUpdAt))) return conflictR();
  await record(store, actor, { targetTyp: "PROJECT", targetId: prjId, actionCd: "UPDATE", summary: r.value });
  return okR(next);
}

export function updateProject(store: Store, actor: ActorFull, prjId: string, expectedUpdAt: string, patch: ProjectPatch) {
  return mutateProject(store, actor, prjId, expectedUpdAt, (p) => {
    if (!patch.prjNm?.trim()) return err(400, "REQUIRED", "과제명을 입력해 주세요.");
    applyPatch(p, patch);
    return okR(`${p.prjNm} 과제 정보 수정`);
  });
}

export interface StageInput {
  cd: string;
  workType?: string;
  ownerId: string | null;
  baseMd: number;
  difficulty?: string;
  grade?: string;
  baseSrc?: string;
  done?: boolean;
  fit?: string;
  spec?: string;
  ctx?: string;
  gen?: string;
}

export interface ReqInput {
  reqId: string;
  name: string;
  stages: StageInput[];
}

export function validateStages(input: StageInput[], users: UserRecord[], prev?: Requirement): ServiceResult<Stage[]> {
  if (!Array.isArray(input) || input.length === 0) return err(400, "NO_STAGE", "단계를 하나 이상 넣어 주세요.");
  const seen = new Set<string>();
  const out: Stage[] = [];
  for (const s of input) {
    if (!STAGES.includes(s.cd as Stage["cd"])) return err(400, "BAD_STAGE", `알 수 없는 단계 ${s.cd}`);
    if (seen.has(s.cd)) return err(400, "DUP_STAGE", "같은 단계를 두 번 넣을 수 없습니다 — 요구사항·단계 하나에 개발자 한 명입니다.");
    seen.add(s.cd);
    const md = Number(s.baseMd);
    if (!Number.isFinite(md) || md < 0) return err(400, "BAD_MD", "기준 M/D 는 0 이상 숫자여야 합니다.");
    const u = s.ownerId ? users.find((x) => x.userId === s.ownerId) : undefined;
    if (s.ownerId && !u) return err(400, "BAD_OWNER", `계정 ${s.ownerId} 가 없습니다.`);
    const old = prev?.stages.find((x) => x.cd === s.cd);
    const t = (v: string | undefined) => (v ?? "").trim();
    out.push({
      cd: s.cd as Stage["cd"],
      workType: t(s.workType),
      ownerId: u?.userId ?? null,
      ownerNm: u?.userNm ?? "",
      baseMd: md,
      difficulty: t(s.difficulty),
      grade: t(s.grade),
      baseSrc: t(s.baseSrc),
      done: !!s.done,
      doneAt: s.done ? (old?.doneAt ?? new Date().toISOString().slice(0, 10)) : null,
      fit: t(s.fit),
      spec: t(s.spec),
      ctx: t(s.ctx),
      gen: t(s.gen),
    });
  }
  return okR(out.sort((a, b) => STAGES.indexOf(a.cd) - STAGES.indexOf(b.cd)));
}

export async function saveRequirement(store: Store, actor: ActorFull, prjId: string, expectedUpdAt: string, origReqId: string | null, input: ReqInput) {
  const users = await store.users.list();
  return mutateProject(store, actor, prjId, expectedUpdAt, (p) => {
    const reqId = (input.reqId ?? "").trim();
    if (!reqId) return err(400, "REQUIRED", "요구사항 ID 를 입력해 주세요.");
    if (/\s/.test(reqId)) return err(400, "BAD_ID", "요구사항 ID 에 공백을 넣을 수 없습니다.");
    // 요구사항 ID 는 과제 안에서만 유일하면 된다 — 공수 태그에 과제 ID 가 붙어 있어서.
    if (p.reqs.some((q) => q.reqId === reqId && q.reqId !== origReqId)) return err(409, "DUP_REQ", `이 과제에 요구사항 ID ${reqId} 가 이미 있습니다.`);
    const prev = origReqId ? p.reqs.find((q) => q.reqId === origReqId) : undefined;
    if (origReqId && !prev) return notFoundR("요구사항");
    // 측정이 시작된 뒤 ID 를 바꾸면 이미 입력한 공수가 끊기므로 막는다.
    if (prev && prev.reqId !== reqId) return err(400, "ID_LOCKED", "요구사항 ID 는 바꿀 수 없습니다. 삭제 후 다시 등록해 주세요.");
    const st = validateStages(input.stages, users, prev);
    if (!st.ok) return st;
    const next: Requirement = { reqId, name: (input.name ?? "").trim(), stages: st.value };
    if (prev) p.reqs[p.reqs.indexOf(prev)] = next;
    else p.reqs.push(next);
    const tags = next.stages.map((s) => `${unitCode(p.prjId, reqId, s.cd)} ${s.baseMd}MD ${s.ownerNm || "미지정"}${s.done ? " 완료" : ""}`);
    return okR(`${reqKey(p.prjId, reqId)} ${prev ? "수정" : "등록"} (${tags.join(", ")})`);
  });
}

export function deleteRequirement(store: Store, actor: ActorFull, prjId: string, expectedUpdAt: string, reqId: string) {
  return mutateProject(store, actor, prjId, expectedUpdAt, (p) => {
    const i = p.reqs.findIndex((q) => q.reqId === reqId);
    if (i < 0) return notFoundR("요구사항");
    p.reqs.splice(i, 1);
    return okR(`${reqKey(p.prjId, reqId)} 삭제`);
  });
}

export async function createProject(store: Store, actor: ActorFull, patch: ProjectPatch): Promise<ServiceResult<Project>> {
  if (!can(actor, "project.manage")) return forbiddenR();
  const prjId = (patch.prjId ?? "").trim();
  if (!PRJ_ID_RE.test(prjId)) return err(400, "BAD_ID", "과제 ID 는 영문·숫자·_ 20자 이내입니다(하이픈 불가 — 공수 태그 구분자).");
  if (!patch.prjNm?.trim()) return err(400, "REQUIRED", "과제명을 입력해 주세요.");
  if (await store.projects.get(prjId)) return err(409, "DUP_PRJ", `과제 ID ${prjId} 가 이미 있습니다.`);
  const now = new Date().toISOString();
  const p = emptyProject(prjId, patch.prjNm.trim(), actor, now);
  applyPatch(p, patch);
  await store.projects.insert(p);
  await record(store, actor, { targetTyp: "PROJECT", targetId: p.prjId, actionCd: "CREATE", summary: `${p.prjId} ${p.prjNm} 등록` });
  return okR(p);
}

export async function deleteProject(store: Store, actor: ActorFull, prjId: string): Promise<ServiceResult<null>> {
  if (!can(actor, "project.manage")) return forbiddenR();
  const p = await store.projects.get(prjId);
  if (!p) return notFoundR("과제");
  await store.projects.remove(prjId);
  await record(store, actor, { targetTyp: "PROJECT", targetId: prjId, actionCd: "DELETE", summary: `${p.prjNm} 삭제 (요구사항 ${p.reqs.length}건)`, diff: { before: p } });
  return okR(null);
}
