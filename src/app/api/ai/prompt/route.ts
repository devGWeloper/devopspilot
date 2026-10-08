import { fail, fromResult, ok, readJson } from "@/lib/api";
import { getPrompt, savePrompt } from "@/lib/ai/service";
import { can } from "@/lib/auth/permissions";
import { loadConfig } from "@/lib/config";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

const off = () => fail(404, "NOT_FOUND", "AI 판정 기능이 꺼져 있습니다.");

export const GET = route(async ({ actor, store }) => {
  if (!loadConfig().llm.enabled) return off();
  if (!can(actor, "ai.use")) return fail(403, "FORBIDDEN", "권한이 없습니다.");
  const cfg = loadConfig().llm;
  return ok({ prompt: await getPrompt(store), model: cfg.model, baseUrlSet: !!cfg.baseUrl });
});

export const PUT = route(async ({ req, actor, store }) => {
  if (!loadConfig().llm.enabled) return off();
  const body = await readJson<{ text: string }>(req);
  return fromResult(await savePrompt(store, actor, body?.text ?? ""));
});
