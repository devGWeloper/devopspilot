import { ok } from "@/lib/api";
import { runChecks } from "@/lib/measure/crosscheck";
import { kstDate } from "@/lib/measure/csv";
import { computeMetrics } from "@/lib/measure/metrics";
import { loadInput } from "@/lib/measure/repo";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = route(async ({ req, store }) => {
  const prj = new URL(req.url).searchParams.get("prjId");
  const projects = (await store.projects.list()).filter((p) => p.status === "SELECTED");
  const ids = prj ? projects.filter((p) => p.prjId === prj).map((p) => p.prjId) : projects.map((p) => p.prjId);
  const input = await loadInput(store, ids);
  return ok({
    projects: projects.map((p) => ({ prjId: p.prjId, prjNm: p.prjNm, finalFit: p.finalFit, suggestFit: p.suggestFit })),
    settings: { featureTypes: input.settings.featureTypes, phases: input.settings.phases, sampleValues: input.settings.sampleValues, laborRatePerHour: input.settings.laborRatePerHour, postFixDays: input.settings.postFixDays },
    metrics: computeMetrics(input),
    evidence: { verified: input.features.filter((f) => f.baseline.evidenceVerified).length, total: input.features.length },
    check: runChecks(input, kstDate(Date.now())),
  });
});
