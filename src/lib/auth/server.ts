import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getStore } from "../store";
import type { ActorFull } from "./permissions";
import { AUTH_COOKIE, getSecret, verifySession } from "./session";

/**
 * 서버 컴포넌트용 — API 의 requireUser 와 같은 기준(매번 계정을 다시 읽음)으로 확인하고, 실패하면 로그인으로 보낸다.
 * 레이아웃과 페이지가 같은 요청에서 둘 다 부르므로 요청 단위로 한 번만 읽는다.
 */
export const pageActor = cache(async (): Promise<ActorFull & { deptNm: string }> => {
  const session = await verifySession(cookies().get(AUTH_COOKIE)?.value, getSecret());
  if (!session) redirect("/login");
  const u = await (await getStore()).users.get(session.sub);
  if (!u || !u.useYn) redirect("/login");
  return { userId: u.userId, role: u.role, userNm: u.userNm, orgCd: u.orgCd, deptNm: u.deptNm };
});
