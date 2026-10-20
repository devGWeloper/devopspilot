import { fail, fromResult, readJson } from "@/lib/api";
import { confirmDate, confirmDays } from "@/lib/measure/service";
import { route } from "@/lib/route";

/** reqId 를 주면 그 요구사항, date 만 주면 그날 내 요구사항 전부 */
export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<{ reqId?: string; dates?: string[]; date?: string }>(req);
  if (body?.reqId) return fromResult(await confirmDays(store, actor, body.reqId, body.dates));
  if (body?.date) return fromResult(await confirmDate(store, actor, body.date));
  return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
});
