import { fail, fromResult, readJson } from "@/lib/api";
import { deleteProject, updateProject, type ProjectPatch } from "@/lib/projects/service";
import { route } from "@/lib/route";

export const PUT = route<{ id: string }>(async ({ req, actor, store, params }) => {
  const body = await readJson<{ expectedUpdAt: string; patch: ProjectPatch }>(req);
  if (!body?.patch || !body.expectedUpdAt) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await updateProject(store, actor, params.id, body.expectedUpdAt, body.patch));
});

export const DELETE = route<{ id: string }>(async ({ actor, store, params }) => fromResult(await deleteProject(store, actor, params.id)));
