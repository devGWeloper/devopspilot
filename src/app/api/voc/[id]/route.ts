import { fail, fromResult, readJson } from "@/lib/api";
import { route } from "@/lib/route";
import { answerVoc, deleteVoc, type VocStatus } from "@/lib/voc/service";

export const PUT = route<{ id: string }>(async ({ req, actor, store, params }) => {
  const body = await readJson<{ status?: VocStatus; reply?: string }>(req);
  if (!body) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await answerVoc(store, actor, decodeURIComponent(params.id), body));
});

export const DELETE = route<{ id: string }>(async ({ actor, store, params }) => fromResult(await deleteVoc(store, actor, decodeURIComponent(params.id))));
