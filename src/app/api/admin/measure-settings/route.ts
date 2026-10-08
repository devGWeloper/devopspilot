import { fail, fromResult, ok, readJson } from "@/lib/api";
import { getSettings } from "@/lib/measure/repo";
import { saveSettings } from "@/lib/measure/service";
import type { MeasureSettings } from "@/lib/measure/types";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = route(async ({ store }) => ok(await getSettings(store)));

export const PUT = route(async ({ req, actor, store }) => {
  const body = await readJson<MeasureSettings>(req);
  if (!body) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await saveSettings(store, actor, body));
});
