import { fail, fromResult, readJson } from "@/lib/api";
import { route } from "@/lib/route";
import { createVoc, type VocInput } from "@/lib/voc/service";

export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<VocInput>(req);
  if (!body) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await createVoc(store, actor, body));
});
