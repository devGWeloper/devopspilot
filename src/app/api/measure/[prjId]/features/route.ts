import { fail, fromResult, readJson } from "@/lib/api";
import { deleteFeature, upsertFeature, type FeatureInput } from "@/lib/measure/service";
import { route } from "@/lib/route";

type P = { prjId: string };

export const POST = route<P>(async ({ req, actor, store, params }) => {
  const body = await readJson<{ feature: FeatureInput; unit?: "h" | "MD" }>(req);
  if (!body?.feature?.baseline) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await upsertFeature(store, actor, params.prjId, body.feature, body.unit === "MD" ? "MD" : "h"));
});

export const DELETE = route<P>(async ({ req, actor, store, params }) => {
  const wbsId = new URL(req.url).searchParams.get("wbsId");
  if (!wbsId) return fail(400, "BAD_REQUEST", "wbsId 가 필요합니다.");
  return fromResult(await deleteFeature(store, actor, params.prjId, wbsId));
});
