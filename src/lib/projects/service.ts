import { can, type ActorFull } from "../auth/permissions";
import { record } from "../history";
import { conflictR, err, forbiddenR, notFoundR, okR, type ServiceResult } from "../result";
import type { Store } from "../store/types";
import { PRJ_KINDS, STAGES, type PrjKind, type Project, type Requirement, type Stage, type UserRecord } from "../types";
import { parseGrid, readWorkbook, type ImportRow, type ParseError } from "./xlsxImport";

export interface ImportSummary {
  projectsNew: number;
  projectsUpdated: number;
  reqsNew: number;
  reqsUpdated: number;
  unknownOwners: string[];
}

function ownerFor(name: string, users: UserRecord[]): { ownerId: string | null; ownerNm: string } {
  const u = users.find((x) => x.useYn && (x.userNm === name || x.userId === name));
  return { ownerId: u?.userId ?? null, ownerNm: u?.userNm ?? name };
}

function emptyProject(prjId: string, prjNm: string, actor: ActorFull, now: string): Project {
  return {
    prjId,
    prjNm,
    sysNm: "",
    kind: "개발",
    deptCd: "",
    teamNm: "",
    axTeam: "",
    pmNm: "",
    sysGrade: "",
    deployType: "",
    area: "",
    wbsYn: "",
    vcs: "",
    pms: "",
    reqs: [],
    regUserId: actor.userId,
    regAt: now,
    updUserId: actor.userId,
    updAt: now,
  };
}

/**
 * 같은 과제명은 같은 과제로, 같은 요구사항 ID 는 정보만 갱신한다.
 * 이미 있는 요구사항의 단계는 건드리지 않는다 — 관리자가 화면에서 나눈 단계·담당을 엑셀 재업로드가 덮으면 안 되기 때문.
 */
export function mergeImport(
  projects: Project[],
  rows: ImportRow[],
  users: UserRecord[],
  actor: ActorFull,
  nextId: () => string,
): { projects: Project[]; changed: Set<string>; summary: ImportSummary; errors: ParseError[] } {
  const now = new Date().toISOString();
  const out = projects.map((p) => structuredClone(p));
  const changed = new Set<string>();
  const errors: ParseError[] = [];
  const s: ImportSummary = { projectsNew: 0, projectsUpdated: 0, reqsNew: 0, reqsUpdated: 0, unknownOwners: [] };
  const unknown = new Set<string>();

  for (const r of rows) {
    let p = out.find((x) => x.prjNm.trim() === r.prj.prjNm);
    const other = out.find((x) => x !== p && x.reqs.some((q) => q.reqId === r.reqId));
    if (other) {
      errors.push({ rowNo: r.rowNo, message: `요구사항 ${r.reqId} 는 이미 다른 과제(${other.prjNm})에 있습니다.` });
      continue;
    }
    if (!p) {
      p = emptyProject(nextId(), r.prj.prjNm, actor, now);
      out.push(p);
      s.projectsNew++;
    } else if (!changed.has(p.prjId)) s.projectsUpdated++;
    changed.add(p.prjId);
    for (const [k, v] of Object.entries(r.prj)) if (v) (p as unknown as Record<string, string>)[k] = v;

    const exist = p.reqs.find((q) => q.reqId === r.reqId);
    const info = { name: r.name, difficulty: r.difficulty, grade: r.grade, baseSrc: r.baseSrc, extra: r.extra };
    if (exist) {
      Object.assign(exist, info);
      s.reqsUpdated++;
    } else {
      const o = ownerFor(r.staff[0] ?? "", users);
      if (!o.ownerId && o.ownerNm) unknown.add(o.ownerNm);
      p.reqs.push({ reqId: r.reqId, ...info, stages: [{ cd: r.stage, workType: r.workType, baseMd: r.baseMd, ...o }], done: false, doneAt: null });
      s.reqsNew++;
    }
    p.updUserId = actor.userId;
  }
  s.unknownOwners = Array.from(unknown);
  return { projects: out, changed, summary: s, errors };
}

export async function importXlsx(store: Store, actor: ActorFull, buf: ArrayBuffer): Promise<ServiceResult<ImportSummary>> {
  if (!can(actor, "project.manage")) return forbiddenR();
  let grid: string[][] | null;
  try {
    grid = await readWorkbook(buf);
  } catch {
    return err(400, "BAD_FILE", "엑셀 파일을 읽지 못했습니다. .xlsx 양식인지 확인해 주세요.");
  }
  if (!grid) return err(400, "NO_SHEET", "'과제·요구사항' 시트가 없습니다.");
  const parsed = parseGrid(grid);
  if (parsed.rows.length === 0 && parsed.errors.length === 0) return err(400, "EMPTY", "올릴 요구사항 행이 없습니다.");

  const before = await store.projects.list();
  let n = Number((await store.projects.nextId()).slice(4));
  const merged = mergeImport(before, parsed.rows, await store.users.list(), actor, () => `PRJ-${String(n++).padStart(4, "0")}`);
  const errors = [...parsed.errors, ...merged.errors].sort((a, b) => a.rowNo - b.rowNo);
  // 일부만 들어가면 엑셀과 포털이 어긋난 채 남으므로 오류가 하나라도 있으면 아무것도 저장하지 않는다.
  if (errors.length) return err(400, "INVALID_ROWS", `${errors.length}개 행에 오류가 있어 올리지 않았습니다.`, errors);

  const now = new Date().toISOString();
  for (const p of merged.projects) {
    if (!merged.changed.has(p.prjId)) continue;
    const prev = before.find((x) => x.prjId === p.prjId);
    const next = { ...p, updAt: now };
    if (!prev) await store.projects.insert(next);
    else if (!(await store.projects.update(next, prev.updAt))) return conflictR();
  }
  await record(store, actor, {
    targetTyp: "PROJECT",
    targetId: "IMPORT",
    actionCd: "IMPORT",
    summary: `엑셀 올리기: 과제 신규 ${merged.summary.projectsNew}·갱신 ${merged.summary.projectsUpdated}, 요구사항 신규 ${merged.summary.reqsNew}·갱신 ${merged.summary.reqsUpdated}`,
  });
  return okR(merged.summary);
}

export interface ProjectPatch {
  prjNm: string;
  sysNm: string;
  kind: PrjKind;
  deptCd: string;
  teamNm: string;
  axTeam: string;
  pmNm: string;
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
    if (!PRJ_KINDS.includes(patch.kind)) return err(400, "BAD_KIND", "구분은 개발·운영 중 하나입니다.");
    Object.assign(p, {
      prjNm: patch.prjNm.trim(),
      sysNm: patch.sysNm ?? "",
      kind: patch.kind,
      deptCd: patch.deptCd ?? "",
      teamNm: patch.teamNm ?? "",
      axTeam: patch.axTeam ?? "",
      pmNm: patch.pmNm ?? "",
    });
    return okR(`${p.prjNm} 과제 정보 수정`);
  });
}

export interface ReqInput {
  reqId: string;
  name: string;
  difficulty: string;
  grade: string;
  baseSrc: string;
  done: boolean;
  stages: { cd: string; workType: string; ownerId: string | null; baseMd: number }[];
}

export function validateStages(input: ReqInput["stages"], users: UserRecord[]): ServiceResult<Stage[]> {
  if (!Array.isArray(input) || input.length === 0) return err(400, "NO_STAGE", "단계를 하나 이상 넣어 주세요.");
  const seen = new Set<string>();
  const out: Stage[] = [];
  for (const s of input) {
    if (!STAGES.includes(s.cd as Stage["cd"])) return err(400, "BAD_STAGE", `알 수 없는 단계 ${s.cd}`);
    if (seen.has(s.cd)) return err(400, "DUP_STAGE", "같은 단계를 두 번 넣을 수 없습니다. 담당이 여럿이면 업무를 나눠 다른 단계로 넣어 주세요.");
    seen.add(s.cd);
    const md = Number(s.baseMd);
    if (!Number.isFinite(md) || md < 0) return err(400, "BAD_MD", "기준 M/D 는 0 이상 숫자여야 합니다.");
    const u = s.ownerId ? users.find((x) => x.userId === s.ownerId) : undefined;
    if (s.ownerId && !u) return err(400, "BAD_OWNER", `계정 ${s.ownerId} 가 없습니다.`);
    out.push({ cd: s.cd as Stage["cd"], workType: (s.workType ?? "").trim(), ownerId: u?.userId ?? null, ownerNm: u?.userNm ?? "", baseMd: md });
  }
  return okR(out.sort((a, b) => STAGES.indexOf(a.cd) - STAGES.indexOf(b.cd)));
}

export async function saveRequirement(store: Store, actor: ActorFull, prjId: string, expectedUpdAt: string, origReqId: string | null, input: ReqInput) {
  const users = await store.users.list();
  const all = await store.projects.list();
  return mutateProject(store, actor, prjId, expectedUpdAt, (p) => {
    const reqId = (input.reqId ?? "").trim();
    if (!reqId || !input.name?.trim()) return err(400, "REQUIRED", "요구사항 ID 와 이름을 입력해 주세요.");
    const clash = all.some((x) => x.reqs.some((q) => q.reqId === reqId && !(x.prjId === prjId && q.reqId === origReqId)));
    if (clash) return err(409, "DUP_REQ", `요구사항 ID ${reqId} 가 이미 있습니다.`);
    const st = validateStages(input.stages, users);
    if (!st.ok) return st;
    const prev = origReqId ? p.reqs.find((q) => q.reqId === origReqId) : undefined;
    if (origReqId && !prev) return notFoundR("요구사항");
    // 측정이 시작된 뒤 ID 를 바꾸면 이미 입력한 공수가 끊기므로 막는다.
    if (prev && prev.reqId !== reqId) return err(400, "ID_LOCKED", "요구사항 ID 는 바꿀 수 없습니다. 삭제 후 다시 등록해 주세요.");
    const next: Requirement = {
      reqId,
      name: input.name.trim(),
      difficulty: input.difficulty ?? "",
      grade: input.grade ?? "",
      baseSrc: input.baseSrc ?? "",
      stages: st.value,
      done: !!input.done,
      doneAt: input.done ? (prev?.doneAt ?? new Date().toISOString()) : null,
      extra: prev?.extra ?? {},
    };
    if (prev) p.reqs[p.reqs.indexOf(prev)] = next;
    else p.reqs.push(next);
    return okR(`${reqId} ${prev ? "수정" : "등록"} (단계 ${next.stages.map((s) => `${s.cd} ${s.baseMd}MD ${s.ownerNm || "미지정"}`).join(", ")})${next.done ? " · 측정 완료" : ""}`);
  });
}

export function deleteRequirement(store: Store, actor: ActorFull, prjId: string, expectedUpdAt: string, reqId: string) {
  return mutateProject(store, actor, prjId, expectedUpdAt, (p) => {
    const i = p.reqs.findIndex((q) => q.reqId === reqId);
    if (i < 0) return notFoundR("요구사항");
    p.reqs.splice(i, 1);
    return okR(`${reqId} 삭제`);
  });
}

export async function createProject(store: Store, actor: ActorFull, patch: ProjectPatch): Promise<ServiceResult<Project>> {
  if (!can(actor, "project.manage")) return forbiddenR();
  if (!patch.prjNm?.trim()) return err(400, "REQUIRED", "과제명을 입력해 주세요.");
  const now = new Date().toISOString();
  const p = { ...emptyProject(await store.projects.nextId(), patch.prjNm.trim(), actor, now), ...patch, prjNm: patch.prjNm.trim() };
  if (!PRJ_KINDS.includes(p.kind)) p.kind = "개발";
  await store.projects.insert(p);
  await record(store, actor, { targetTyp: "PROJECT", targetId: p.prjId, actionCd: "CREATE", summary: `${p.prjNm} 등록` });
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
