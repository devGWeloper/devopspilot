import { fail, fromResult, ok, readJson } from "@/lib/api";
import { toView, updateProject, type ProjectInput } from "@/lib/projects/service";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

type P = { id: string };

export const GET = route<P>(async ({ actor, store, params }) => {
  const p = await store.projects.get(params.id);
  if (!p) return fail(404, "NOT_FOUND", "과제를 찾을 수 없습니다.");
  return ok(toView(p, actor));
});

export const PUT = route<P>(async ({ req, actor, store, params }) => {
  const body = await readJson<ProjectInput & { updAt: string }>(req);
  if (!body?.base || !body.updAt) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  const r = await updateProject(store, actor, params.id, body, body.updAt);
  return fromResult(r.ok ? { ok: true, value: toView(r.value, actor) } : r);
});
