import { fail, fromResult, readJson } from "@/lib/api";
import { saveEffort, type EffortInput } from "@/lib/measure/service";
import { route } from "@/lib/route";

export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<EffortInput>(req);
  if (!body?.unit || !body.date) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await saveEffort(store, actor, body));
});
