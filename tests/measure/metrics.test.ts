import { describe, it, expect } from "vitest";
import { aiCostOf, computeMetrics } from "@/lib/measure/metrics";
import { sampleMeasureInput } from "@/lib/measure/sampleData";
import type { MeasureInput } from "@/lib/measure/types";

const by = (r: ReturnType<typeof computeMetrics>, w: string) => r.byFeature.find((f) => f.feature.wbsId === w)!;

describe("seed 기대값", () => {
  const r = computeMetrics(sampleMeasureInput());

  it("기능별 절감률 60% / 39% / 17%", () => {
    expect(Math.round(by(r, "WBS-3.2.1").savingRate! * 100)).toBe(60);
    expect(Math.round(by(r, "WBS-3.4.2").savingRate! * 100)).toBe(39);
    expect(Math.round(by(r, "WBS-4.1.3").savingRate! * 100)).toBe(17);
  });

  it("A·B 합계", () => {
    expect([by(r, "WBS-3.2.1").a, by(r, "WBS-3.2.1").b]).toEqual([40, 16]);
    expect([by(r, "WBS-3.4.2").a, by(r, "WBS-3.4.2").b]).toEqual([56, 34]);
    expect([by(r, "WBS-4.1.3").a, by(r, "WBS-4.1.3").b]).toEqual([24, 20]);
  });

  it("전체 절감률은 공수 가중 (120-70)/120, 단순 평균이 아니다", () => {
    expect(r.overall.savingRate).toBeCloseTo(50 / 120, 9);
    const simple = (24 / 40 + 22 / 56 + 4 / 24) / 3;
    expect(Math.abs(r.overall.savingRate! - simple)).toBeGreaterThan(0.01);
  });

  it("기능당 투입시간 70/3", () => {
    expect(r.overall.hoursPerFeature).toBeCloseTo(70 / 3, 9);
  });

  it("단계별 절감률", () => {
    expect(r.overall.phaseSaving.DESIGN).toBeCloseTo((24 - 13) / 24, 9);
    expect(r.overall.phaseSaving.DEV).toBeCloseTo((70 - 37) / 70, 9);
    expect(r.overall.phaseSaving.UNIT).toBeCloseTo((26 - 20) / 26, 9);
    expect(r.overall.phaseSaving.INTEG).toBeNull();
  });

  it("WBS-3.2.1 의 10-22 커밋은 사후 수정", () => {
    expect(by(r, "WBS-3.2.1").postFixLines).toBe(18);
    expect(by(r, "WBS-3.4.2").postFixLines).toBe(0);
  });

  it("규모: 40h→L, 56h→L, 24h→M", () => {
    expect(by(r, "WBS-3.2.1").size).toBe("L");
    expect(by(r, "WBS-3.4.2").size).toBe("L");
    expect(by(r, "WBS-4.1.3").size).toBe("M");
  });

  it("기능이 2개 미만인 칸은 참고값", () => {
    expect(r.byTypeSize["SCREEN|L"].reference).toBe(true);
    expect(r.byTypeSize["SCREEN|L"].featureCount).toBe(1);
    expect(r.overall.reference).toBe(false);
  });

  it("결함률 A=6/3, B=3/3", () => {
    expect(r.overall.defectRateA).toBeCloseTo(6 / 3, 9);
    expect(r.overall.defectRateB).toBeCloseTo(3 / 3, 9);
  });

  it("사후 수정률 = 사후 라인 / 완료 기능 WBS 전체 라인", () => {
    expect(r.overall.postFixLines).toBe(18);
    expect(r.overall.postFixRate).toBeCloseTo(18 / r.overall.totalLines, 9);
  });
});

describe("경제성", () => {
  it("AI 비용: 토큰 4종 × 단가 ÷ 1M", () => {
    const cost = aiCostOf(
      { prjId: "P", wbsId: "W", workDt: "2026-10-01", userId: "u", model: "m", requests: 1, inputTokens: 1_000_000, outputTokens: 2_000_000, cacheReadTokens: 3_000_000, cacheWriteTokens: 4_000_000, reportedCost: null, srcCd: "MANUAL" },
      [{ model: "m", input: 1, output: 10, cacheRead: 100, cacheWrite: 1000 }],
    );
    expect(cost).toBe(1 + 20 + 300 + 4000);
  });

  it("단가가 없는 모델은 null 이고 미설정 목록에 나온다", () => {
    const input = sampleMeasureInput();
    input.usages.push({ ...input.usages[0], model: "unknown-model" });
    const r = computeMetrics(input);
    expect(r.unpricedModels).toContain("unknown-model");
  });

  it("기능당 총비용·비용 차이", () => {
    const input = sampleMeasureInput();
    input.settings.laborRatePerHour = 50_000;
    const r = computeMetrics(input);
    const aiDone = r.byFeature.reduce((s, f) => s + f.aiCost, 0);
    expect(r.overall.costPerFeature).toBeCloseTo((70 * 50_000 + aiDone) / 3, 6);
    expect(r.overall.costDiffPerFeature).toBeCloseTo((120 * 50_000) / 3 - (70 * 50_000 + aiDone) / 3, 6);
  });

  it("AI 요청 수는 일자별로도 집계된다", () => {
    const r = computeMetrics(sampleMeasureInput());
    expect(r.requestsByDay.reduce((s, d) => s + d.requests, 0)).toBe(r.overall.aiRequests);
    expect(r.requestsByDay.map((d) => d.date)).toEqual([...r.requestsByDay.map((d) => d.date)].sort());
  });
});

describe("경계·예외", () => {
  it("완료 기능이 없으면 null (NaN/Infinity 아님)", () => {
    const input = sampleMeasureInput();
    input.features.forEach((f) => ((f.status = "DOING"), (f.completedAt = null)));
    const m = computeMetrics(input).overall;
    expect(m.savingRate).toBeNull();
    expect(m.hoursPerFeature).toBeNull();
    expect(m.costPerFeature).toBeNull();
    expect(m.costDiffPerFeature).toBeNull();
    expect(m.defectRateA).toBeNull();
    expect(m.postFixRate).toBeNull();
  });

  it("미완료 기능의 공수는 생산성 지표에서 빠진다", () => {
    const input = sampleMeasureInput();
    input.features.find((f) => f.wbsId === "WBS-4.1.3")!.status = "DOING";
    const m = computeMetrics(input).overall;
    expect(m.sumA).toBe(96);
    expect(m.sumB).toBe(50);
    expect(m.doneCount).toBe(2);
    expect(m.featureCount).toBe(3);
  });

  it("통합테스트를 켜면 A·B 모두 그 단계를 포함한다", () => {
    const input: MeasureInput = sampleMeasureInput();
    input.settings.phases.INTEG = true;
    const f = input.features.find((x) => x.wbsId === "WBS-3.2.1")!;
    f.baseline.INTEG = 10;
    input.efforts.push({ prjId: f.prjId, wbsId: f.wbsId, workDt: "2026-10-10", phase: "INTEG", hours: 2, userId: "dev01", aiLevel: null, memo: "", srcCd: "MANUAL" });
    const r = computeMetrics(input);
    expect([by(r, "WBS-3.2.1").a, by(r, "WBS-3.2.1").b]).toEqual([50, 18]);
    expect(r.overall.phaseSaving.INTEG).toBeCloseTo(0.8, 9);
  });

  it("통합테스트가 꺼져 있으면 기록이 있어도 제외", () => {
    const input = sampleMeasureInput();
    input.efforts.push({ prjId: "PRJ-0001", wbsId: "WBS-3.2.1", workDt: "2026-10-10", phase: "INTEG", hours: 5, userId: "dev01", aiLevel: null, memo: "", srcCd: "MANUAL" });
    expect(by(computeMetrics(input), "WBS-3.2.1").b).toBe(16);
  });

  it("변경 라인이 0 이면 사후 수정률 null", () => {
    const input = sampleMeasureInput();
    input.commits = [];
    expect(computeMetrics(input).overall.postFixRate).toBeNull();
  });

  it("A 가 0 이면 절감률 null", () => {
    const input = sampleMeasureInput();
    const f = input.features[0];
    f.baseline = { ...f.baseline, DESIGN: 0, DEV: 0, UNIT: 0, INTEG: 0 };
    expect(by(computeMetrics(input), f.wbsId).savingRate).toBeNull();
  });

  it("과제별 집계", () => {
    const r = computeMetrics(sampleMeasureInput());
    expect(Object.keys(r.byProject)).toEqual(["PRJ-0001"]);
    expect(r.byProject["PRJ-0001"].savingRate).toBeCloseTo(50 / 120, 9);
  });
});
