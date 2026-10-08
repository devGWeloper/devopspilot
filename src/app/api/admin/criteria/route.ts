import { fail, fromResult, ok, readJson } from "@/lib/api";
import { getDraft, hasDraftChanges, saveDraft } from "@/lib/criteria/admin";
import { getPublishedCriteria } from "@/lib/criteria/service";
import { route } from "@/lib/route";
import type { Criteria } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = route(async ({ store }) => {
  return ok({ draft: await getDraft(store), published: await getPublishedCriteria(store), dirty: await hasDraftChanges(store) });
});

export const PUT = route(async ({ req, actor, store }) => {
  const body = await readJson<Criteria>(req);
  if (!body) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await saveDraft(store, actor, body));
});
