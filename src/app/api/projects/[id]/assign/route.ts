import { fail, fromResult, readJson } from "@/lib/api";
import { assignStage } from "@/lib/projects/service";
import { route } from "@/lib/route";

export const PUT = route<{ id: string }>(async ({ req, actor, store, params }) => {
  const body = await readJson<{ reqId: string; cd: string; ownerId?: string | null; done?: boolean }>(req);
  if (!body?.reqId || !body.cd) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await assignStage(store, actor, params.id, body));
});
