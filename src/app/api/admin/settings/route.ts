import { fail, fromResult, readJson } from "@/lib/api";
import { saveSettings } from "@/lib/measure/service";
import type { Settings } from "@/lib/measure/types";
import { route } from "@/lib/route";

export const PUT = route(async ({ req, actor, store }) => {
  const body = await readJson<Settings>(req);
  if (!body) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await saveSettings(store, actor, body));
});
