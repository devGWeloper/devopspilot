import { fail, handle, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "@/lib/auth/password";
import { record } from "@/lib/history";
import { getStore } from "@/lib/store";

export const POST = handle(async (req: Request) => {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const body = await readJson<{ current?: string; next?: string }>(req);
  const store = await getStore();
  const u = await store.users.get(g.actor.userId);
  if (!u || !verifyPassword(body?.current ?? "", u.pwdHash, u.pwdSalt)) {
    return fail(400, "INVALID_CURRENT", "현재 비밀번호가 올바르지 않습니다.");
  }
  const policy = validatePasswordPolicy(body?.next ?? "");
  if (policy) return fail(422, "POLICY", policy);
  const { hash, salt } = hashPassword(body!.next!);
  await store.users.update(u.userId, { pwdHash: hash, pwdSalt: salt, updAt: new Date().toISOString() });
  await record(store, g.actor, { targetTyp: "USER", targetId: u.userId, actionCd: "PASSWORD", summary: "비밀번호 변경" });
  return ok({ ok: true });
});
