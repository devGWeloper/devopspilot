import { fail, fromResult, readJson } from "@/lib/api";
import { submitProject, toView } from "@/lib/projects/service";
import { route } from "@/lib/route";

export const POST = route<{ id: string }>(async ({ req, actor, store, params }) => {
  const body = await readJson<{ updAt: string }>(req);
  if (!body?.updAt) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  const r = await submitProject(store, actor, params.id, body.updAt);
  return fromResult(r.ok ? { ok: true, value: toView(r.value, actor) } : r);
});
