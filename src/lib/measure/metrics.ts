// replay.md 4절 지표 9개의 유일한 계산 위치. 화면·엑셀·API 는 이 결과만 쓴다.
import { isPostFix } from "./postfix";
import { classifySize } from "./size";
import { PHASES, type AiUse, type Feature, type FeatureMetric, type MeasureInput, type MetricSet, type MetricsResult, type Phase, type TokenPrice } from "./types";

const REFERENCE_MIN = 2;

const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);

export function aiCostOf(u: AiUse, prices: TokenPrice[]): number | null {
  const p = prices.find((x) => x.model === u.model);
  if (!p) return null;
  return (u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite) / 1_000_000;
}

function emptyPhases(): Record<Phase, number> {
  return { DESIGN: 0, DEV: 0, UNIT: 0, INTEG: 0 };
}

function featureMetrics(input: MeasureInput): FeatureMetric[] {
  const { settings: st } = input;
  const on = PHASES.filter((p) => st.phases[p]);
  const key = (prjId: string, wbsId: string | null) => `${prjId}|${wbsId}`;
  const effortsBy = new Map<string, MeasureInput["efforts"]>();
  for (const e of input.efforts) {
    const k = key(e.prjId, e.wbsId);
    effortsBy.set(k, [...(effortsBy.get(k) ?? []), e]);
  }

  return input.features.map((f) => {
    const k = key(f.prjId, f.wbsId);
    const aByPhase = emptyPhases();
    const bByPhase = emptyPhases();
    for (const p of on) aByPhase[p] = f.baseline[p] ?? 0;
    const effs = effortsBy.get(k) ?? [];
    for (const e of effs) if (st.phases[e.phase]) bByPhase[e.phase] += e.hours;
    const a = on.reduce((s, p) => s + aByPhase[p], 0);
    const b = on.reduce((s, p) => s + bByPhase[p], 0);
    const uses = input.usages.filter((u) => key(u.prjId, u.wbsId) === k);
    const commits = input.commits.filter((c) => key(c.prjId, c.wbsId) === k);
    const lines = (c: MeasureInput["commits"][number]) => c.added + c.deleted;
    const dates = effs.map((e) => e.workDt).sort();
    const { size, outOfRange } = classifySize(a, st.sizeBands);
    return {
      feature: f,
      a,
      b,
      aByPhase,
      bByPhase,
      savingRate: ratio(a - b, a),
      size,
      sizeOutOfRange: outOfRange,
      aiCost: uses.reduce((s, u) => s + (aiCostOf(u, st.tokenPrices) ?? 0), 0),
      aiRequests: uses.reduce((s, u) => s + u.requests, 0),
      defectsB: input.defects.filter((d) => key(d.prjId, d.wbsId) === k).length,
      postFixLines: commits.filter((c) => isPostFix(c.workDt, f.completedAt, st.postFixDays)).reduce((s, c) => s + lines(c), 0),
      totalLines: commits.reduce((s, c) => s + lines(c), 0),
      firstWorkDt: dates[0] ?? null,
      lastWorkDt: dates[dates.length - 1] ?? null,
    };
  });
}

const isDone = (f: Feature) => f.status === "DONE" && !!f.completedAt;

function aggregate(fms: FeatureMetric[], input: MeasureInput, usages: AiUse[]): MetricSet {
  const rate = input.settings.laborRatePerHour;
  const done = fms.filter((m) => isDone(m.feature));
  const n = done.length;
  const sumA = done.reduce((s, m) => s + m.a, 0);
  const sumB = done.reduce((s, m) => s + m.b, 0);
  const phaseSaving = {} as Record<Phase, number | null>;
  for (const p of PHASES) {
    const a = done.reduce((s, m) => s + m.aByPhase[p], 0);
    const b = done.reduce((s, m) => s + m.bByPhase[p], 0);
    phaseSaving[p] = input.settings.phases[p] ? ratio(a - b, a) : null;
  }
  const aiCostDone = done.reduce((s, m) => s + m.aiCost, 0);
  const postFixLines = done.reduce((s, m) => s + m.postFixLines, 0);
  const totalLines = done.reduce((s, m) => s + m.totalLines, 0);
  const costPerFeature = n > 0 ? (sumB * rate + aiCostDone) / n : null;
  return {
    featureCount: fms.length,
    doneCount: n,
    reference: fms.length < REFERENCE_MIN,
    sumA,
    sumB,
    hoursPerFeature: ratio(sumB, n),
    savingRate: ratio(sumA - sumB, sumA),
    phaseSaving,
    aiCost: usages.reduce((s, u) => s + (aiCostOf(u, input.settings.tokenPrices) ?? 0), 0),
    aiRequests: usages.reduce((s, u) => s + u.requests, 0),
    costPerFeature,
    costDiffPerFeature: n > 0 && costPerFeature !== null ? (sumA * rate) / n - costPerFeature : null,
    defectRateA: ratio(done.reduce((s, m) => s + m.feature.baseline.defects, 0), n),
    defectRateB: ratio(done.reduce((s, m) => s + m.defectsB, 0), n),
    postFixRate: ratio(postFixLines, totalLines),
    postFixLines,
    totalLines,
  };
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}

export function computeMetrics(input: MeasureInput): MetricsResult {
  const fms = featureMetrics(input);
  const usageOf = (fs: FeatureMetric[]) => {
    const keys = new Set(fs.map((m) => `${m.feature.prjId}|${m.feature.wbsId}`));
    return input.usages.filter((u) => keys.has(`${u.prjId}|${u.wbsId}`));
  };

  const byProject: Record<string, MetricSet> = {};
  for (const [prj, list] of groupBy(fms, (m) => m.feature.prjId)) {
    byProject[prj] = aggregate(list, input, input.usages.filter((u) => u.prjId === prj));
  }
  const byType: Record<string, MetricSet> = {};
  for (const [t, list] of groupBy(fms, (m) => m.feature.typeCd)) byType[t] = aggregate(list, input, usageOf(list));
  const byTypeSize: Record<string, MetricSet> = {};
  for (const [k, list] of groupBy(fms, (m) => `${m.feature.typeCd}|${m.size}`)) byTypeSize[k] = aggregate(list, input, usageOf(list));

  const days = new Map<string, { requests: number; cost: number }>();
  for (const u of input.usages) {
    const d = days.get(u.workDt) ?? { requests: 0, cost: 0 };
    d.requests += u.requests;
    d.cost += aiCostOf(u, input.settings.tokenPrices) ?? 0;
    days.set(u.workDt, d);
  }

  return {
    overall: aggregate(fms, input, input.usages),
    byProject,
    byType,
    byTypeSize,
    byFeature: fms,
    requestsByDay: Array.from(days.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
    unpricedModels: Array.from(new Set(input.usages.filter((u) => aiCostOf(u, input.settings.tokenPrices) === null).map((u) => u.model))),
  };
}
