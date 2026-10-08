import { fail, ok, readJson } from "@/lib/api";
import { getPublishedCriteria } from "@/lib/criteria/service";
import { impactOf, validateCriteria } from "@/lib/criteria/validate";
import { route } from "@/lib/route";
import type { Criteria } from "@/lib/types";

export const POST = route(async ({ req, store }) => {
  const body = await readJson<Criteria>(req);
  if (!body?.areas) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  const published = await getPublishedCriteria(store);
  return ok({ errors: validateCriteria(body), impact: impactOf(await store.projects.list(), published, body) });
});
