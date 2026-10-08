import { fail, fromResult, readJson } from "@/lib/api";
import { addManualUsage } from "@/lib/measure/service";
import type { AiUse } from "@/lib/measure/types";
import { route } from "@/lib/route";

export const POST = route<{ prjId: string }>(async ({ req, actor, store, params }) => {
  const body = await readJson<Omit<AiUse, "prjId" | "srcCd" | "reportedCost">>(req);
  if (!body) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await addManualUsage(store, actor, params.prjId, { ...body, userId: body.userId || actor.userId }), 201);
});
