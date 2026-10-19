import { describe, it, expect } from "vitest";
import { defaultSettings } from "@/lib/measure/defaults";
import type { StoredSession } from "@/lib/measure/match";
import { aggUnits, buildIndex, cellOf, confirmedSum, daySnap, metricDefs, nextDayConfRate, nextDayDeadline, rowsOf, sessionCost, tagRate, type MeasureData } from "@/lib/measure/metrics";
import type { DayConf, EffortEntry } from "@/lib/measure/types";
import { mkProject, mkReq, mkStage } from "../helpers";

const D = "2026-11-10";
const U = "DAE01-R1-DV";
const settings = {
  ...defaultSettings(),
  mdHours: 8,
  measureStart: "2026-11-01",
  gradePrice: { 중급: 400000 },
  tokenPrice: { "gpt-5-codex": { input: 2000, cached: 200, output: 10000 } },
};
const req = mkReq({ reqId: "R1", stages: [mkStage({ cd: "DV", ownerId: "dev01", baseMd: 2, grade: "중급" })] });
// 입력 100만(캐시 50만) · 출력 10만 → 50만×2000 + 50만×200 + 10만×10000 = 1,000,000+100,000+1,000,000 (÷1e6) = 2,100원
const session: StoredSession = {
  datId: "A|1",
  src: "OTEL",
  sessionId: "s",
  userId: "dev01",
  workDt: D,
  tool: "Codex",
  minutes: 240,
  start: "",
  end: "",
  branch: "",
  hints: [U],
  resolution: null,
  tokens: { "gpt-5-codex": { input: 1_000_000, cached: 500_000, output: 100_000 } },
};
const effort: EffortEntry = { unit: U, prjId: "DAE01", reqId: "R1", stage: "DV", userId: "dev01", workDt: D, reduceH: 1, add: { A1: 2, A5: 0.5 }, memo: "" };

function data(confs: DayConf[] = [], extra: Partial<MeasureData> = {}): MeasureData {
  return { projects: [mkProject({ reqs: [req] })], efforts: [effort], confs, sessions: [session], settings, ...extra };
}
const confOf = (ix0: ReturnType<typeof buildIndex>, p: Partial<DayConf> = {}): DayConf => ({
  userId: "dev01",
  prjId: "DAE01",
  reqId: "R1",
  workDt: D,
  state: "CONF",
  confirmedAt: "2026-11-10T09:00:00.000Z",
  revCount: 0,
  snap: daySnap(ix0, "dev01", ix0.data.projects[0].reqs[0], D),
  ...p,
});

describe("AI 비용 — 토큰 단가", () => {
  it("(입력 − 캐시)·캐시·출력 단가를 따로 곱한다", () => {
    expect(sessionCost(settings, session)).toBeCloseTo(2100);
  });
  it("토큰이 없거나 단가 없는 모델이면 빈칸(null)", () => {
    expect(sessionCost(settings, { ...session, tokens: undefined })).toBeNull();
    expect(sessionCost(settings, { ...session, tokens: { "o3": { input: 1, cached: 0, output: 1 } } })).toBeNull();
  });
  it("빈칸 비용은 0 으로 더하고 건수를 센다", () => {
    const ix = buildIndex(data([], { sessions: [{ ...session, tokens: undefined }] }));
    expect(cellOf(ix, U, D)).toMatchObject({ aiCost: 0, aiNa: 1 });
  });
});

describe("cell", () => {
  it("AI 도구 내 = 수집 − 감소, 투입 = 내 + 외", () => {
    const c = cellOf(buildIndex(data()), U, D);
    expect(c).toMatchObject({ ai: 4, mn: 1, inT: 3, out: 2.5, tot: 5.5 });
    expect(c.aiCost).toBeCloseTo(2100);
  });

  it("감소는 수집값을 넘지 않는다", () => {
    const ix = buildIndex({ ...data(), efforts: [{ ...effort, reduceH: 9 }] });
    expect(cellOf(ix, U, D)).toMatchObject({ mn: 4, inT: 0 });
  });
});

describe("확정·집계", () => {
  it("확정 전에는 결과(confirmedOnly)에 안 들어가고 진척에는 들어간다", () => {
    const ix = buildIndex(data());
    expect(aggUnits(ix, ix.units, true).tot).toBe(0);
    expect(aggUnits(ix, ix.units, false).tot).toBe(5.5);
    expect(rowsOf(ix, "dev01", req)[0].st).toBe("need");
  });

  it("집계 로직 8개 중 공수·비용 지표", () => {
    const ix = buildIndex(data([confOf(buildIndex(data()))]));
    const a = aggUnits(ix, ix.units, true);
    const md = 5.5 / 8;
    expect(a.md).toBeCloseTo(md);
    expect(a.save).toBeCloseTo(1 - md / 2);
    expect(a.saveMd).toBeCloseTo(2 - md);
    expect(a.baseCost).toBe(800000);
    expect(a.labor).toBeCloseTo(md * 400000);
    expect(a.netAmt).toBeCloseTo(800000 - md * 400000 - 2100);
    expect(a.net).toBeCloseTo((800000 - md * 400000 - 2100) / 800000);
    expect(a.use).toBeCloseTo(3 / 5.5);
    expect(a.outShare).toBeCloseTo(2.5 / 5.5);
    expect(a.byType.A1).toBe(2);
    expect(confirmedSum(ix, "dev01", req)).toMatchObject({ tot: 5.5, md });
  });

  it("인건비는 태그(단계)의 필요 개발자 등급 단가", () => {
    const r = mkReq({ reqId: "R1", stages: [mkStage({ cd: "DV", baseMd: 1, grade: "특급" })] });
    const ix = buildIndex({ ...data(), projects: [mkProject({ reqs: [r] })], settings: { ...settings, gradePrice: { 특급: 900000, 중급: 1 } } });
    expect(aggUnits(ix, ix.units, false).baseCost).toBe(900000);
  });

  it("확정 뒤 수집값이 늦게 들어오면 다시 확정 필요가 되고 집계에서 빠진다", () => {
    const late: StoredSession = { ...session, datId: "A|2", sessionId: "s2", minutes: 30 };
    const ix = buildIndex({ ...data([confOf(buildIndex(data()))]), sessions: [session, late] });
    expect(rowsOf(ix, "dev01", req)[0]).toMatchObject({ st: "edit", changed: true });
    expect(aggUnits(ix, ix.units, true).tot).toBe(0);
  });

  it("다른 과제의 같은 요구사항 ID 확정은 섞이지 않는다", () => {
    const other = mkProject({ prjId: "LMS03", reqs: [mkReq({ reqId: "R1", stages: [mkStage({ cd: "DV", ownerId: "dev01" })] })] });
    const base = data([], { projects: [mkProject({ reqs: [req] }), other] });
    const ix = buildIndex({ ...base, confs: [confOf(buildIndex(base))] });
    expect(rowsOf(ix, "dev01", ix.data.projects[0].reqs[0])[0].st).toBe("conf");
    expect(rowsOf(ix, "dev01", ix.data.projects[1].reqs[0])).toHaveLength(0);
  });

  it("기준 공수가 0 이면 비율은 null", () => {
    const r0 = { ...req, stages: [{ ...req.stages[0], baseMd: 0 }] };
    const ix = buildIndex({ ...data(), projects: [mkProject({ reqs: [r0] })] });
    expect(aggUnits(ix, ix.units, false).save).toBeNull();
  });
});

describe("보조 · 관리 지표", () => {
  it("태그 입력률 = 자동 배정 분 ÷ 수집 분 전체", () => {
    const manual: StoredSession = { ...session, datId: "A|2", hints: [], minutes: 60, resolution: { kind: "ASSIGN", parts: [{ unit: U, min: 60 }], by: "dev01", at: "" } };
    const pend: StoredSession = { ...session, datId: "A|3", hints: [], minutes: 100 };
    const ix = buildIndex(data([], { sessions: [session, manual, pend] }));
    expect(tagRate(ix, null)).toMatchObject({ num: 240, den: 400, rate: 0.6 });
  });

  it("다음 날 마감은 다음 영업일 23:59:59 KST", () => {
    expect(nextDayDeadline("2026-11-10")).toBe("2026-11-11T14:59:59.000Z");
    expect(nextDayDeadline("2026-11-13")).toBe("2026-11-16T14:59:59.000Z"); // 금 → 월
  });

  it("다음 날 확정률 — 첫 확정 시각으로 판정, 마감 전인 날은 제외", () => {
    const ix0 = buildIndex(data());
    const after = "2026-11-20T00:00:00.000Z";
    const onTime = buildIndex(data([confOf(ix0, { confirmedAt: "2026-11-15T00:00:00.000Z", firstConfirmedAt: "2026-11-11T01:00:00.000Z", revCount: 1 })]));
    expect(nextDayConfRate(onTime, null, after)).toMatchObject({ num: 1, den: 1, rate: 1 });
    const lateIx = buildIndex(data([confOf(ix0, { confirmedAt: "2026-11-12T01:00:00.000Z" })]));
    expect(nextDayConfRate(lateIx, null, after)).toMatchObject({ num: 0, den: 1, late: [{ userId: "dev01", date: D }] });
    expect(nextDayConfRate(buildIndex(data()), null, "2026-11-11T00:00:00.000Z").den).toBe(0);
  });

  it("산식 문구의 1 M/D 분은 설정을 따른다", () => {
    expect(metricDefs(8).map((m) => m.name)).toEqual(["투입 공수 절감률", "절감 공수 (M/D)", "비용 순절감률", "비용 순절감액 (원)", "AI 활용률", "AI 밖 비중", "태그 입력률", "다음 날 확정률"]);
    expect(metricDefs(8)[0].formula).toContain("× 480");
    expect(metricDefs(7.5)[1].formula).toContain("÷ 450");
  });
});
