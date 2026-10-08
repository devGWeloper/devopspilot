import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { fail } from "../api";
import { getStore } from "../store";
import type { OrgCd } from "../types";
import type { Actor } from "./permissions";
import { AUTH_COOKIE, getSecret, verifySession } from "./session";

export type ActorFull = Actor & { userNm: string; orgCd: OrgCd };

export type Guard = { ok: true; actor: ActorFull } | { ok: false; res: NextResponse };

// 쿠키의 역할을 믿지 않고 매 요청 계정을 다시 읽는다 — 역할 변경·비활성화가 즉시 반영돼야
// 고객사 계정 회수가 세션 만료(8시간)를 기다리지 않는다.
export async function requireUser(): Promise<Guard> {
  const session = await verifySession(cookies().get(AUTH_COOKIE)?.value, getSecret());
  if (!session) return { ok: false, res: fail(401, "UNAUTHENTICATED", "로그인이 필요합니다.") };
  const store = await getStore();
  const u = await store.users.get(session.sub);
  if (!u || !u.useYn) return { ok: false, res: fail(401, "UNAUTHENTICATED", "사용할 수 없는 계정입니다.") };
  return { ok: true, actor: { userId: u.userId, role: u.role, userNm: u.userNm, orgCd: u.orgCd } };
}

export function forbidden(message = "접근 권한이 없습니다."): NextResponse {
  return fail(403, "FORBIDDEN", message);
}
