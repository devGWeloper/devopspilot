import { can, reviewSide, type ActorFull } from "../auth/permissions";
import { getPublishedCriteria } from "../criteria/service";
import { shallowDiff } from "../diff";
import { deriveColumns, evaluateFit, FIT_LABEL, reconcileAnswers } from "../fitness";
import { record } from "../history";
import { STATUS_LABEL } from "../labels";
import { conflictR, err, forbiddenR, notFoundR, okR, type ServiceResult } from "../result";
import { DuplicateKeyError, type Store } from "../store/types";
import type { AgreeCd, Criteria, Level, Project, ProjectStatus, ReviewEntry } from "../types";
import { validateDraft, validateForSubmit, type ProjectInput } from "./validate";

export type { ProjectInput } from "./validate";

const TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: [],
  SUPPLEMENT: [],
  SUBMITTED: ["REVIEW", "SUPPLEMENT"],
  REVIEW: ["SUPPLEMENT", "SELECTED", "RESERVE", "EXCLUDED"],
  SELECTED: ["REVIEW", "RESERVE", "EXCLUDED"],
  RESERVE: ["REVIEW", "SELECTED", "EXCLUDED"],
  EXCLUDED: ["REVIEW"],
};

const NOTE_REQUIRED: ProjectStatus[] = ["SUPPLEMENT", "EXCLUDED"];

export function allowedTransitions(from: ProjectStatus): ProjectStatus[] {
  return TRANSITIONS[from];
}

export function noteRequired(to: ProjectStatus): boolean {
  return NOTE_REQUIRED.includes(to);
}

export function toView(p: Project, actor: ActorFull | { role: string }): Project {
  if (actor.role === "AX_ADMIN") return p;
  return { ...p, ai: null, aiFit: null };
}

function now() {
  return new Date().toISOString();
}

// 같은 밀리초에 두 번 저장되면 낙관적 동시성 비교가 무력화되므로 이전 값보다 반드시 커지게 한다.
function nextStamp(prev: string): string {
  const t = now();
  if (t > prev) return t;
  return new Date(new Date(prev).getTime() + 1).toISOString();
}

function summaryOf(p: Project) {
  return {
    prjNm: p.prjNm,
    sysNm: p.sysNm,
    pmUserId: p.pmUserId,
    status: p.status,
    statusNote: p.statusNote,
    suggestFit: p.suggestFit,
    finalFit: p.finalFit,
    answers: p.eval.answers,
    base: p.base,
  };
}

function clean(input: ProjectInput, c: Criteria) {
  const { answers, notes } = reconcileAnswers(c, input.answers ?? {}, input.notes ?? {});
  return {
    prjNm: input.prjNm.trim(),
    sysNm: (input.sysNm ?? "").trim(),
    base: {
      ...input.base,
      langCds: Array.from(new Set(input.base.langCds ?? [])),
      description: input.base.description ?? "",
      techStack: input.base.techStack ?? "",
      orgNm: input.base.orgNm ?? "",
    },
    answers,
    notes: Object.fromEntries(Object.entries(notes).filter(([, v]) => typeof v === "string" && v.trim())),
  };
}

async function save(
  store: Store,
  actor: ActorFull,
  before: Project,
  after: Project,
  expectedUpdAt: string,
  actionCd: string,
  summary: string,
): Promise<ServiceResult<Project>> {
  const saved = { ...after, updUserId: actor.userId, updAt: nextStamp(before.updAt) };
  if (!(await store.projects.update(saved, expectedUpdAt))) return conflictR();
  await record(store, actor, {
    targetTyp: "PROJECT",
    targetId: saved.prjId,
    actionCd,
    summary,
    diff: shallowDiff(summaryOf(before), summaryOf(saved)),
  });
  return okR(saved);
}

export async function createProject(store: Store, actor: ActorFull, input: ProjectInput): Promise<ServiceResult<Project>> {
  if (!can(actor, "project.create")) return forbiddenR();
  const errors = validateDraft(input);
  if (errors.length) return err(422, "VALIDATION", errors[0].message, errors);

  let pmUserId = actor.userId;
  let pmUserNm = actor.userNm;
  if (actor.role === "AX_ADMIN") {
    if (!input.pmUserId) return err(422, "VALIDATION", "과제 PM 을 지정해 주세요.", [{ field: "pmUserId", message: "과제 PM 을 지정해 주세요." }]);
    const pm = await store.users.get(input.pmUserId);
    if (!pm || pm.role !== "PM" || !pm.useYn) {
      return err(422, "VALIDATION", "PM 역할의 활성 계정만 지정할 수 있습니다.", [{ field: "pmUserId", message: "PM 계정이 아닙니다." }]);
    }
    pmUserId = pm.userId;
    pmUserNm = pm.userNm;
  }

  const c = await getPublishedCriteria(store);
  const x = clean(input, c);
  const t = now();
  const evalData = { answers: x.answers, notes: x.notes, confirm: null };
  const reviews: ReviewEntry[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const p: Project = {
      prjId: await store.projects.nextId(),
      prjNm: x.prjNm,
      sysNm: x.sysNm,
      pmUserId,
      pmUserNm,
      status: "DRAFT",
      statusNote: null,
      aiFit: null,
      axAgree: "NONE",
      hxAgree: "NONE",
      base: x.base,
      eval: evalData,
      reviews,
      ai: null,
      regUserId: actor.userId,
      regAt: t,
      updUserId: actor.userId,
      updAt: t,
      ...deriveColumns(c, { base: x.base, eval: evalData }),
    };
    try {
      await store.projects.insert(p);
    } catch (e) {
      // 두 사람이 동시에 등록하면 같은 번호를 받을 수 있다 — 번호를 다시 받아 재시도.
      if (e instanceof DuplicateKeyError) continue;
      throw e;
    }
    await record(store, actor, { targetTyp: "PROJECT", targetId: p.prjId, actionCd: "CREATE", summary: `과제 등록: ${p.prjNm}` });
    return okR(p);
  }
  return err(409, "ID_CONFLICT", "과제 번호 발급이 충돌했습니다. 다시 시도해 주세요.");
}

export async function updateProject(
  store: Store,
  actor: ActorFull,
  id: string,
  input: ProjectInput,
  expectedUpdAt: string,
): Promise<ServiceResult<Project>> {
  const before = await store.projects.get(id);
  if (!before) return notFoundR("과제");
  if (!can(actor, "project.edit", { project: before })) return forbiddenR("이 과제를 수정할 권한이 없습니다.");
  const errors = validateDraft(input);
  if (errors.length) return err(422, "VALIDATION", errors[0].message, errors);

  let { pmUserId, pmUserNm } = before;
  if (actor.role === "AX_ADMIN" && input.pmUserId && input.pmUserId !== before.pmUserId) {
    const pm = await store.users.get(input.pmUserId);
    if (!pm || pm.role !== "PM" || !pm.useYn) return err(422, "VALIDATION", "PM 역할의 활성 계정만 지정할 수 있습니다.");
    pmUserId = pm.userId;
    pmUserNm = pm.userNm;
  }

  const c = await getPublishedCriteria(store);
  const x = clean(input, c);
  const evalData = { ...before.eval, answers: x.answers, notes: x.notes };
  const after: Project = {
    ...before,
    prjNm: x.prjNm,
    sysNm: x.sysNm,
    pmUserId,
    pmUserNm,
    base: x.base,
    eval: evalData,
    ...deriveColumns(c, { base: x.base, eval: evalData }),
  };
  return save(store, actor, before, after, expectedUpdAt, "UPDATE", "과제 정보 수정");
}

export async function submitProject(store: Store, actor: ActorFull, id: string, expectedUpdAt: string): Promise<ServiceResult<Project>> {
  const before = await store.projects.get(id);
  if (!before) return notFoundR("과제");
  if (!can(actor, "project.submit", { project: before })) return forbiddenR("제출할 수 없는 상태이거나 권한이 없습니다.");
  const c = await getPublishedCriteria(store);
  const errors = validateForSubmit(
    { prjNm: before.prjNm, sysNm: before.sysNm, base: before.base, answers: before.eval.answers, notes: before.eval.notes },
    c,
  );
  if (errors.length) return err(422, "VALIDATION", `제출 전에 ${errors.length}개 항목을 채워 주세요.`, errors);
  return save(store, actor, before, { ...before, status: "SUBMITTED", statusNote: null }, expectedUpdAt, "SUBMIT", "과제 제출");
}

export async function changeStatus(
  store: Store,
  actor: ActorFull,
  id: string,
  to: ProjectStatus,
  note: string | null,
  expectedUpdAt: string,
): Promise<ServiceResult<Project>> {
  const before = await store.projects.get(id);
  if (!before) return notFoundR("과제");
  if (!can(actor, "project.status", { project: before })) return forbiddenR();
  if (!TRANSITIONS[before.status].includes(to)) {
    return err(409, "INVALID_TRANSITION", `'${STATUS_LABEL[before.status]}'에서 '${STATUS_LABEL[to]}'(으)로 바꿀 수 없습니다.`);
  }
  const n = note?.trim() || null;
  if (NOTE_REQUIRED.includes(to) && !n) return err(422, "VALIDATION", `'${STATUS_LABEL[to]}'(으)로 바꿀 때는 사유가 필요합니다.`);
  return save(
    store,
    actor,
    before,
    { ...before, status: to, statusNote: n },
    expectedUpdAt,
    "STATUS",
    `상태 변경: ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[to]}${n ? ` (${n})` : ""}`,
  );
}

export async function confirmFit(
  store: Store,
  actor: ActorFull,
  id: string,
  fit: Level,
  reason: string,
  expectedUpdAt: string,
): Promise<ServiceResult<Project>> {
  const before = await store.projects.get(id);
  if (!before) return notFoundR("과제");
  if (!can(actor, "project.confirm", { project: before })) return forbiddenR();
  if (!["H", "M", "L"].includes(fit)) return err(422, "VALIDATION", "적합도 값이 올바르지 않습니다.");
  const r = reason?.trim() ?? "";
  if (fit !== before.suggestFit && !r) return err(422, "VALIDATION", "제안 적합도와 다르게 확정할 때는 사유가 필요합니다.");
  const confirm = { fit, reason: r, by: actor.userId, byNm: actor.userNm, at: now() };
  const after: Project = { ...before, eval: { ...before.eval, confirm }, finalFit: fit };
  return save(store, actor, before, after, expectedUpdAt, "CONFIRM", `적합도 확정: ${FIT_LABEL[fit]}${r ? ` (${r})` : ""}`);
}

export async function clearConfirm(store: Store, actor: ActorFull, id: string, expectedUpdAt: string): Promise<ServiceResult<Project>> {
  const before = await store.projects.get(id);
  if (!before) return notFoundR("과제");
  if (!can(actor, "project.confirm", { project: before })) return forbiddenR();
  const after: Project = { ...before, eval: { ...before.eval, confirm: null }, finalFit: "NA" };
  return save(store, actor, before, after, expectedUpdAt, "CONFIRM", "적합도 확정 취소");
}

export async function addReview(
  store: Store,
  actor: ActorFull,
  id: string,
  input: { agree: AgreeCd; text: string; context: "SELECTION" | "MEASURE" },
): Promise<ServiceResult<Project>> {
  const action = input.context === "MEASURE" ? "measure.comment" : "project.review";
  if (!can(actor, action)) return forbiddenR("의견을 남길 권한이 없습니다.");
  const side = reviewSide(actor);
  if (!side) return forbiddenR();
  const text = input.text?.trim() ?? "";
  if (!text) return err(422, "VALIDATION", "의견을 입력해 주세요.");
  if (text.length > 2000) return err(422, "VALIDATION", "의견은 2000자 이내로 입력해 주세요.");
  if (!["AGREE", "DISAGREE", "HOLD", "NONE"].includes(input.agree)) return err(422, "VALIDATION", "동의 상태가 올바르지 않습니다.");

  // 의견 스레드는 덧붙이기만 하므로 다른 편집과 충돌로 막지 않는다 — 최신본을 읽어 바로 붙이고, 그 사이 경합이면 다시 읽는다.
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await store.projects.get(id);
    if (!before) return notFoundR("과제");
    const entry: ReviewEntry = {
      id: `${id}-r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      side,
      userId: actor.userId,
      userNm: actor.userNm,
      agree: input.agree,
      text,
      at: now(),
      context: input.context,
    };
    const after: Project = {
      ...before,
      reviews: [...before.reviews, entry],
      ...(input.context === "SELECTION" && input.agree !== "NONE"
        ? side === "AX"
          ? { axAgree: input.agree }
          : { hxAgree: input.agree }
        : {}),
    };
    const r = await save(store, actor, before, after, before.updAt, "REVIEW", `${side} 의견: ${text.slice(0, 80)}`);
    if (r.ok || r.code !== "CONFLICT") return r;
  }
  return conflictR();
}

export async function reevaluateAll(store: Store, actor: ActorFull): Promise<ServiceResult<{ changed: number }>> {
  if (!can(actor, "criteria.manage")) return forbiddenR();
  const c = await getPublishedCriteria(store);
  let changed = 0;
  for (const p of await store.projects.list()) {
    const { answers, notes } = reconcileAnswers(c, p.eval.answers, p.eval.notes);
    const evalData = { ...p.eval, answers, notes };
    const derived = deriveColumns(c, { base: p.base, eval: evalData });
    const after: Project = { ...p, eval: evalData, ...derived };
    if (JSON.stringify(after) === JSON.stringify(p)) continue;
    const r = await save(store, actor, p, after, p.updAt, "REEVALUATE", `평가 기준 v${c.version} 로 재판정 (${FIT_LABEL[p.suggestFit]} → ${FIT_LABEL[derived.suggestFit]})`);
    if (r.ok) changed++;
  }
  return okR({ changed });
}

export function previewFit(c: Criteria, answers: Record<string, string>) {
  return evaluateFit(c, answers);
}
