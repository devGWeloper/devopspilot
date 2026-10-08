import { fail, fromResult, readJson } from "@/lib/api";
import { addReview, toView } from "@/lib/projects/service";
import { route } from "@/lib/route";
import type { AgreeCd } from "@/lib/types";

export const POST = route<{ id: string }>(async ({ req, actor, store, params }) => {
  const body = await readJson<{ agree: AgreeCd; text: string; context?: "SELECTION" | "MEASURE" }>(req);
  if (!body) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  const r = await addReview(store, actor, params.id, {
    agree: body.agree ?? "NONE",
    text: body.text ?? "",
    context: body.context ?? "SELECTION",
  });
  return fromResult(r.ok ? { ok: true, value: toView(r.value, actor) } : r, 201);
});
