import { fail, fromResult, ok, readJson } from "@/lib/api";
import { createProject, toView, type ProjectInput } from "@/lib/projects/service";
import { route } from "@/lib/route";
import { matchesFilter } from "@/lib/projects/filter";

export const dynamic = "force-dynamic";

export const GET = route(async ({ req, actor, store }) => {
  const sp = new URL(req.url).searchParams;
  const all = await store.projects.list();
  return ok(all.filter((p) => matchesFilter(p, sp)).map((p) => toView(p, actor)));
});

export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<ProjectInput>(req);
  if (!body?.base) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await createProject(store, actor, body), 201);
});
