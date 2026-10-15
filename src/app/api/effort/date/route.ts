import { fail, fromResult, readJson } from "@/lib/api";
import { confirmDate, reopenDate } from "@/lib/measure/service";
import { route } from "@/lib/route";

/** confirm = 그날 입력 전부 확정, reopen = 그날 확정을 풀고 고치기 */
export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<{ date: string; action: "confirm" | "reopen" }>(req);
  if (!body?.date) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(body.action === "reopen" ? await reopenDate(store, actor, body.date) : await confirmDate(store, actor, body.date));
});
