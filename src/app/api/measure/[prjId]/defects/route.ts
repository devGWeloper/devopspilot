import { fail, fromResult, readJson } from "@/lib/api";
import { addDefect, removeDefect, type DefectInput } from "@/lib/measure/service";
import { route } from "@/lib/route";

type P = { prjId: string };

export const POST = route<P>(async ({ req, actor, store, params }) => {
  const body = await readJson<DefectInput>(req);
  if (!body) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await addDefect(store, actor, params.prjId, body), 201);
});

export const DELETE = route<P>(async ({ req, actor, store, params }) => {
  const id = new URL(req.url).searchParams.get("defectId");
  if (!id) return fail(400, "BAD_REQUEST", "defectId 가 필요합니다.");
  return fromResult(await removeDefect(store, actor, params.prjId, id));
});
