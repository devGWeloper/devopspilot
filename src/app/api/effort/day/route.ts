import { fail, fromResult, readJson } from "@/lib/api";
import { addExtraDay, reopenDay } from "@/lib/measure/service";
import { route } from "@/lib/route";

/** reopen = 확정 풀고 고치기, extra = 기록 없는 날 입력 줄 만들기 */
export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<{ reqId: string; date: string; action: "reopen" | "extra" }>(req);
  if (!body?.reqId || !body.date) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  const fn = body.action === "reopen" ? reopenDay : addExtraDay;
  return fromResult(await fn(store, actor, body.reqId, body.date));
});
