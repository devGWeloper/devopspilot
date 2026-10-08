import { fail, fromResult, readJson } from "@/lib/api";
import { assessProject } from "@/lib/ai/service";
import { loadConfig } from "@/lib/config";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

export const POST = route(async ({ req, actor, store }) => {
  if (!loadConfig().llm.enabled) return fail(404, "NOT_FOUND", "AI 판정 기능이 꺼져 있습니다.");
  const body = await readJson<{ prjId: string }>(req);
  if (!body?.prjId) return fail(400, "BAD_REQUEST", "과제를 지정해 주세요.");
  return fromResult(await assessProject(store, actor, body.prjId));
});
