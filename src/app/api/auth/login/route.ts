import { NextResponse } from "next/server";
import { fail, handle, readJson } from "@/lib/api";
import { checkLock, recordFailure, recordSuccess } from "@/lib/auth/loginLimiter";
import { verifyPassword } from "@/lib/auth/password";
import { homePathFor } from "@/lib/auth/permissions";
import { AUTH_COOKIE, SESSION_TTL_SEC, getSecret, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const body = await readJson<{ userId?: string; password?: string }>(req);
  const userId = body?.userId?.trim() ?? "";
  const password = body?.password ?? "";
  if (!userId || !password) return fail(400, "BAD_REQUEST", "아이디와 비밀번호를 입력해 주세요.");

  const lock = checkLock(userId);
  if (lock.locked) {
    return fail(429, "LOCKED", `로그인 실패가 반복되어 잠겼습니다. ${Math.ceil(lock.retryAfterSec / 60)}분 후 다시 시도해 주세요.`);
  }

  const store = await getStore();
  const u = await store.users.get(userId);
  if (!u || !verifyPassword(password, u.pwdHash, u.pwdSalt)) {
    recordFailure(userId);
    return fail(401, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다.");
  }
  if (!u.useYn) return fail(403, "DISABLED", "비활성화된 계정입니다. 관리자에게 문의해 주세요.");

  recordSuccess(userId);
  await store.users.update(userId, { lastLoginAt: new Date().toISOString() });
  const token = await signSession({ sub: u.userId, name: u.userNm, role: u.role, org: u.orgCd }, getSecret());
  const res = NextResponse.json({
    data: { userId: u.userId, userNm: u.userNm, role: u.role, orgCd: u.orgCd, home: homePathFor(u.role) },
  });
  res.cookies.set(AUTH_COOKIE, token, sessionCookieOptions(SESSION_TTL_SEC));
  return res;
});
