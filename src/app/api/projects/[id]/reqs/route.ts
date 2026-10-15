import { fail, fromResult, readJson } from "@/lib/api";
import { deleteRequirement, saveRequirement, type ReqInput } from "@/lib/projects/service";
import { route } from "@/lib/route";

/** 등록·수정 — origReqId 가 없으면 신규 */
export const POST = route<{ id: string }>(async ({ req, actor, store, params }) => {
  const body = await readJson<{ expectedUpdAt: string; origReqId: string | null; req: ReqInput }>(req);
  if (!body?.req || !body.expectedUpdAt) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await saveRequirement(store, actor, params.id, body.expectedUpdAt, body.origReqId ?? null, body.req));
});

export const DELETE = route<{ id: string }>(async ({ req, actor, store, params }) => {
  const body = await readJson<{ expectedUpdAt: string; reqId: string }>(req);
  if (!body?.reqId || !body.expectedUpdAt) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await deleteRequirement(store, actor, params.id, body.expectedUpdAt, body.reqId));
});
