import { fail, fromResult, readJson } from "@/lib/api";
import { changeStatus, toView } from "@/lib/projects/service";
import { route } from "@/lib/route";
import { STATUSES, type ProjectStatus } from "@/lib/types";

export const POST = route<{ id: string }>(async ({ req, actor, store, params }) => {
  const body = await readJson<{ to: ProjectStatus; note?: string; updAt: string }>(req);
  if (!body?.updAt || !STATUSES.includes(body.to)) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  const r = await changeStatus(store, actor, params.id, body.to, body.note ?? null, body.updAt);
  return fromResult(r.ok ? { ok: true, value: toView(r.value, actor) } : r);
});
