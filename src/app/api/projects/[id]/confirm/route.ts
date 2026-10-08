import { fail, fromResult, readJson } from "@/lib/api";
import { clearConfirm, confirmFit, toView } from "@/lib/projects/service";
import { route } from "@/lib/route";
import type { Level } from "@/lib/types";

type P = { id: string };

export const POST = route<P>(async ({ req, actor, store, params }) => {
  const body = await readJson<{ fit: Level; reason?: string; updAt: string }>(req);
  if (!body?.updAt || !body.fit) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  const r = await confirmFit(store, actor, params.id, body.fit, body.reason ?? "", body.updAt);
  return fromResult(r.ok ? { ok: true, value: toView(r.value, actor) } : r);
});

export const DELETE = route<P>(async ({ req, actor, store, params }) => {
  const updAt = new URL(req.url).searchParams.get("updAt");
  if (!updAt) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  const r = await clearConfirm(store, actor, params.id, updAt);
  return fromResult(r.ok ? { ok: true, value: toView(r.value, actor) } : r);
});
