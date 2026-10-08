import { fail, fromResult, readJson } from "@/lib/api";
import { kstDate } from "@/lib/measure/csv";
import { setGridCell } from "@/lib/measure/service";
import type { Phase } from "@/lib/measure/types";
import { route } from "@/lib/route";

export const PUT = route<{ prjId: string }>(async ({ req, actor, store, params }) => {
  const body = await readJson<{ wbsId: string; phase: Phase; hours: number }>(req);
  if (!body?.wbsId || !body.phase) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await setGridCell(store, actor, params.prjId, body.wbsId, body.phase, Number(body.hours), kstDate(Date.now())));
});
