import { fail, fromResult, readJson } from "@/lib/api";
import { resolveSession, type ResolveInput } from "@/lib/measure/service";
import { route } from "@/lib/route";

export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<{ datId: string } & ResolveInput>(req);
  if (!body?.datId) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await resolveSession(store, actor, body.datId, body));
});
