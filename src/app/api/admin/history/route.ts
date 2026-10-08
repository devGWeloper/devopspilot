import { fail, ok } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { route } from "@/lib/route";
import type { HistoryTarget } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = route(async ({ req, actor, store }) => {
  if (!can(actor, "history.view")) return fail(403, "FORBIDDEN", "권한이 없습니다.");
  const sp = new URL(req.url).searchParams;
  return ok(
    await store.history.list({
      targetTyp: (sp.get("targetTyp") as HistoryTarget) || undefined,
      targetId: sp.get("targetId") || undefined,
      userId: sp.get("userId") || undefined,
      from: sp.get("from") ? `${sp.get("from")}T00:00:00.000Z` : undefined,
      to: sp.get("to") ? `${sp.get("to")}T23:59:59.999Z` : undefined,
      limit: Math.min(Number(sp.get("limit")) || 300, 1000),
    }),
  );
});
