import { fail, fromResult, readJson } from "@/lib/api";
import { saveJiraMapping } from "@/lib/measure/service";
import type { JiraMapping } from "@/lib/measure/types";
import { route } from "@/lib/route";

export const PUT = route<{ prjId: string }>(async ({ req, actor, store, params }) => {
  const body = await readJson<JiraMapping>(req);
  if (!body?.idCol) return fail(400, "BAD_REQUEST", "매핑을 확인해 주세요.");
  return fromResult(await saveJiraMapping(store, actor, params.prjId, body));
});
