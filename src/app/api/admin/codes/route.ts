import { fail, fromResult, readJson } from "@/lib/api";
import { saveCodes } from "@/lib/criteria/admin";
import { route } from "@/lib/route";
import type { Codes } from "@/lib/types";

export const PUT = route(async ({ req, actor, store }) => {
  const body = await readJson<Codes>(req);
  if (!body) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await saveCodes(store, actor, body));
});
