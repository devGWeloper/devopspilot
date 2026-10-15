import { fail, fromResult, readJson } from "@/lib/api";
import { confirmDays } from "@/lib/measure/service";
import { route } from "@/lib/route";

export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<{ reqId: string; dates?: string[] }>(req);
  if (!body?.reqId) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await confirmDays(store, actor, body.reqId, body.dates));
});
