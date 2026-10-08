import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const u = await (await getStore()).users.get(g.actor.userId);
  return ok({ userId: g.actor.userId, userNm: g.actor.userNm, role: g.actor.role, orgCd: g.actor.orgCd, deptNm: u?.deptNm ?? "" });
});
