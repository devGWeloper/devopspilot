import { fail, ok } from "@/lib/api";
import { runChecks } from "@/lib/measure/crosscheck";
import { kstDate } from "@/lib/measure/csv";
import { computeMetrics } from "@/lib/measure/metrics";
import { loadInput } from "@/lib/measure/repo";
import { toView } from "@/lib/projects/service";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = route<{ prjId: string }>(async ({ actor, store, params }) => {
  const p = await store.projects.get(params.prjId);
  if (!p) return fail(404, "NOT_FOUND", "과제를 찾을 수 없습니다.");
  const input = await loadInput(store, [p.prjId]);
  return ok({
    project: toView(p, actor),
    input,
    metrics: computeMetrics(input),
    check: runChecks(input, kstDate(Date.now())),
  });
});
