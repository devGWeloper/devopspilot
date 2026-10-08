import { randomBytes } from "crypto";
import { hashPassword, validatePasswordPolicy } from "../auth/password";
import { can, ROLE_LABEL, type ActorFull } from "../auth/permissions";
import { record } from "../history";
import { err, forbiddenR, notFoundR, okR, type ServiceResult } from "../result";
import type { Store } from "../store/types";
import { ROLES, type OrgCd, type PublicUser, type Role, type UserRecord } from "../types";

export function toPublic(u: UserRecord): PublicUser {
  const { pwdHash: _h, pwdSalt: _s, ...rest } = u;
  return rest;
}

export interface UserInput {
  userId: string;
  userNm: string;
  orgCd: OrgCd;
  deptNm: string;
  role: Role;
  password: string;
}

const ID_RE = /^[A-Za-z0-9._-]{2,50}$/;

function validate(p: Partial<UserInput>): string | null {
  if (p.userNm !== undefined && !p.userNm.trim()) return "이름을 입력해 주세요.";
  if (p.orgCd !== undefined && !["SKAX", "SKHYNIX"].includes(p.orgCd)) return "소속이 올바르지 않습니다.";
  if (p.role !== undefined && !ROLES.includes(p.role)) return "역할이 올바르지 않습니다.";
  return null;
}

export async function createUser(store: Store, actor: ActorFull, input: UserInput): Promise<ServiceResult<PublicUser>> {
  if (!can(actor, "users.manage")) return forbiddenR();
  const id = input.userId?.trim() ?? "";
  if (!ID_RE.test(id)) return err(422, "VALIDATION", "ID 는 영문·숫자·._- 2~50자로 입력해 주세요.");
  const v = validate(input);
  if (v) return err(422, "VALIDATION", v);
  const pw = validatePasswordPolicy(input.password);
  if (pw) return err(422, "VALIDATION", pw);
  if (await store.users.get(id)) return err(409, "DUPLICATE", "이미 사용 중인 ID 입니다.");
  const { hash, salt } = hashPassword(input.password);
  const now = new Date().toISOString();
  const u: UserRecord = {
    userId: id,
    userNm: input.userNm.trim(),
    orgCd: input.orgCd,
    deptNm: input.deptNm?.trim() ?? "",
    role: input.role,
    useYn: true,
    pwdHash: hash,
    pwdSalt: salt,
    lastLoginAt: null,
    regAt: now,
    updAt: now,
  };
  await store.users.insert(u);
  await record(store, actor, { targetTyp: "USER", targetId: id, actionCd: "CREATE", summary: `계정 생성: ${u.userNm} (${ROLE_LABEL[u.role]})` });
  return okR(toPublic(u));
}

async function activeAdmins(store: Store): Promise<string[]> {
  return (await store.users.list()).filter((u) => u.role === "AX_ADMIN" && u.useYn).map((u) => u.userId);
}

export async function updateUser(
  store: Store,
  actor: ActorFull,
  id: string,
  patch: Partial<Pick<UserRecord, "userNm" | "orgCd" | "deptNm" | "role" | "useYn">>,
): Promise<ServiceResult<PublicUser>> {
  if (!can(actor, "users.manage")) return forbiddenR();
  const before = await store.users.get(id);
  if (!before) return notFoundR("계정");
  const v = validate(patch);
  if (v) return err(422, "VALIDATION", v);
  const losesAdmin = before.role === "AX_ADMIN" && before.useYn && ((patch.role && patch.role !== "AX_ADMIN") || patch.useYn === false);
  // 관리자가 한 명도 남지 않으면 계정을 되살릴 사람이 없다.
  if (losesAdmin && (await activeAdmins(store)).length <= 1) {
    return err(409, "LAST_ADMIN", "마지막 AX 관리자 계정은 비활성화하거나 역할을 바꿀 수 없습니다.");
  }
  const clean = {
    ...(patch.userNm !== undefined ? { userNm: patch.userNm.trim() } : {}),
    ...(patch.orgCd !== undefined ? { orgCd: patch.orgCd } : {}),
    ...(patch.deptNm !== undefined ? { deptNm: patch.deptNm.trim() } : {}),
    ...(patch.role !== undefined ? { role: patch.role } : {}),
    ...(patch.useYn !== undefined ? { useYn: !!patch.useYn } : {}),
    updAt: new Date().toISOString(),
  };
  await store.users.update(id, clean);
  const after = (await store.users.get(id))!;
  const changes = [
    before.role !== after.role ? `역할 ${ROLE_LABEL[before.role]}→${ROLE_LABEL[after.role]}` : null,
    before.useYn !== after.useYn ? (after.useYn ? "활성화" : "비활성화") : null,
    before.userNm !== after.userNm ? "이름 변경" : null,
  ].filter(Boolean);
  await record(store, actor, { targetTyp: "USER", targetId: id, actionCd: "UPDATE", summary: `계정 수정: ${after.userNm}${changes.length ? ` (${changes.join(", ")})` : ""}` });
  return okR(toPublic(after));
}

export async function resetPassword(store: Store, actor: ActorFull, id: string): Promise<ServiceResult<{ password: string }>> {
  if (!can(actor, "users.manage")) return forbiddenR();
  const u = await store.users.get(id);
  if (!u) return notFoundR("계정");
  const password = randomBytes(9).toString("base64url").slice(0, 10) + "!";
  const { hash, salt } = hashPassword(password);
  await store.users.update(id, { pwdHash: hash, pwdSalt: salt, updAt: new Date().toISOString() });
  await record(store, actor, { targetTyp: "USER", targetId: id, actionCd: "RESET_PASSWORD", summary: `비밀번호 초기화: ${u.userNm}` });
  return okR({ password });
}
