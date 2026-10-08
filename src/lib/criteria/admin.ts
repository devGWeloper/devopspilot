import { can, type ActorFull } from "../auth/permissions";
import { record } from "../history";
import { err, forbiddenR, okR, type ServiceResult } from "../result";
import type { Store } from "../store/types";
import type { Codes, Criteria } from "../types";
import { getCodes, getPublishedCriteria } from "./service";
import { validateCriteria } from "./validate";

const DRAFT = "CRITERIA_DRAFT";

export async function getDraft(store: Store): Promise<Criteria> {
  const published = await getPublishedCriteria(store);
  const d = (await store.config.get<Criteria>(DRAFT))?.value;
  // 다른 사람이 그 사이 새 버전을 게시했다면 낡은 초안은 버리고 최신 게시본에서 다시 시작한다.
  if (!d || d.version < published.version) return JSON.parse(JSON.stringify(published));
  return d;
}

export async function hasDraftChanges(store: Store): Promise<boolean> {
  const d = (await store.config.get<Criteria>(DRAFT))?.value;
  if (!d) return false;
  const p = await getPublishedCriteria(store);
  return d.version >= p.version && JSON.stringify({ ...d, publishedAt: null, publishedBy: null }) !== JSON.stringify({ ...p, publishedAt: null, publishedBy: null });
}

export async function saveDraft(store: Store, actor: ActorFull, c: Criteria): Promise<ServiceResult<Criteria>> {
  if (!can(actor, "criteria.manage")) return forbiddenR();
  if (!c || !Array.isArray(c.areas) || !c.rule) return err(400, "BAD_REQUEST", "기준 형식이 올바르지 않습니다.");
  const published = await getPublishedCriteria(store);
  const draft: Criteria = { ...c, version: published.version, publishedAt: published.publishedAt, publishedBy: published.publishedBy };
  await store.config.set(DRAFT, draft, published.version, actor.userId);
  return okR(draft);
}

export async function publishDraft(store: Store, actor: ActorFull): Promise<ServiceResult<Criteria>> {
  if (!can(actor, "criteria.manage")) return forbiddenR();
  const draft = await getDraft(store);
  const errors = validateCriteria(draft);
  if (errors.length) return err(422, "VALIDATION", errors[0], errors);
  const prev = await getPublishedCriteria(store);
  const next: Criteria = { ...draft, version: prev.version + 1, publishedAt: new Date().toISOString(), publishedBy: actor.userNm };
  await store.config.set(`CRITERIA@${next.version}`, next, next.version, actor.userId);
  await store.config.set("CRITERIA", next, next.version, actor.userId);
  await store.config.set(DRAFT, next, next.version, actor.userId);
  const inds = next.areas.flatMap((a) => a.indicators);
  await record(store, actor, {
    targetTyp: "CRITERIA",
    targetId: `v${next.version}`,
    actionCd: "PUBLISH",
    summary: `평가 기준 v${next.version} 게시 (지표 ${inds.length}개, Major ${inds.filter((i) => i.tier === "MAJOR").length}개)`,
    diff: { from: prev.version, to: next.version },
  });
  return okR(next);
}

export async function listVersions(store: Store): Promise<{ version: number; publishedAt: string | null; publishedBy: string | null; indicators: number; majors: number }[]> {
  const keys = await store.config.keys("CRITERIA@");
  const out = [];
  for (const k of keys) {
    const c = (await store.config.get<Criteria>(k))?.value;
    if (!c) continue;
    const inds = c.areas.flatMap((a) => a.indicators);
    out.push({ version: c.version, publishedAt: c.publishedAt, publishedBy: c.publishedBy, indicators: inds.length, majors: inds.filter((i) => i.tier === "MAJOR").length });
  }
  return out.sort((a, b) => b.version - a.version);
}

export async function getVersion(store: Store, version: number): Promise<Criteria | null> {
  return (await store.config.get<Criteria>(`CRITERIA@${version}`))?.value ?? null;
}

export function validateCodes(c: Codes): string[] {
  const e: string[] = [];
  for (const [name, list] of [
    ["언어", c.langs],
    ["도메인", c.domains],
    ["시스템 유형", c.sysTypes],
  ] as const) {
    if (!Array.isArray(list) || list.length === 0) e.push(`${name} 코드가 1개 이상 있어야 합니다.`);
    const codes = (list ?? []).map((x) => x.code);
    if (new Set(codes).size !== codes.length) e.push(`${name} 코드가 중복됩니다.`);
    if ((list ?? []).some((x) => !x.code?.trim() || !x.label?.trim())) e.push(`${name} 코드·이름은 비울 수 없습니다.`);
  }
  const t = c.target;
  const nums = [t?.total, t?.byFit?.H, t?.byFit?.M, t?.byFit?.L, t?.minPerDevType, t?.minLangKinds];
  if (nums.some((n) => typeof n !== "number" || !Number.isInteger(n) || n < 0)) e.push("목표 값은 0 이상의 정수여야 합니다.");
  return e;
}

export async function saveCodes(store: Store, actor: ActorFull, c: Codes): Promise<ServiceResult<Codes>> {
  if (!can(actor, "codes.manage")) return forbiddenR();
  const errors = validateCodes(c);
  if (errors.length) return err(422, "VALIDATION", errors[0], errors);
  const prev = await store.config.get<Codes>("CODES");
  await store.config.set("CODES", c, (prev?.verNo ?? 0) + 1, actor.userId);
  await record(store, actor, { targetTyp: "CODES", targetId: "CODES", actionCd: "UPDATE", summary: "코드·선정 목표 변경", diff: { before: prev?.value ?? null, after: c } });
  return okR(c);
}

export { getCodes };
