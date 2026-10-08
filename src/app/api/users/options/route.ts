import { ok } from "@/lib/api";
import { route } from "@/lib/route";
import { ROLES, type Role } from "@/lib/types";

export const dynamic = "force-dynamic";

// 선택 목록용 최소 정보만 내린다(비밀번호 해시 등은 포함하지 않음).
export const GET = route(async ({ req, store }) => {
  const role = new URL(req.url).searchParams.get("role") as Role | null;
  const users = await store.users.list();
  return ok(
    users
      .filter((u) => u.useYn && (!role || !ROLES.includes(role) || u.role === role))
      .map((u) => ({ userId: u.userId, userNm: u.userNm, role: u.role, orgCd: u.orgCd, deptNm: u.deptNm })),
  );
});
