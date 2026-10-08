import { fail, fromResult } from "@/lib/api";
import { ping } from "@/lib/ai/service";
import { can } from "@/lib/auth/permissions";
import { loadConfig } from "@/lib/config";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

export const POST = route(async ({ actor }) => {
  if (!loadConfig().llm.enabled) return fail(404, "NOT_FOUND", "AI 판정 기능이 꺼져 있습니다.");
  if (!can(actor, "ai.use")) return fail(403, "FORBIDDEN", "권한이 없습니다.");
  return fromResult(await ping());
});
