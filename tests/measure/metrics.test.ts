import { describe, it, expect } from "vitest";
import { defaultSettings } from "@/lib/measure/defaults";
import type { StoredSession } from "@/lib/measure/match";
import { aggUnits, buildIndex, cellOf, confirmedSum, daySnap, rowsOf, type MeasureData } from "@/lib/measure/metrics";
import type { DayConf, EffortEntry } from "@/lib/measure/types";
import { mkProject, mkReq, mkStage } from "../helpers";

const D = "2026-11-10";
const settings = { ...defaultSettings(), mdHours: 8, gradePrice: { 중급: 400000 }, aiRate: { "Claude Code": 10000 }, defaultAiRate: 10000 };
const req = mkReq({ reqId: "R-1", grade: "중급", stages: [mkStage({ cd: "DV", ownerId: "dev01", baseMd: 2 })] });
const session: StoredSession = {
  datId: "A|1",
  src: "OTEL",
  sessionId: "s",
  userId: "dev01",
  workDt: D,
  tool: "Claude Code",
  minutes: 240,
  start: "",
  end: "",
  branch: "",
  hints: ["R-1-DV"],
  resolution: null,
};
const effort: EffortEntry = { unit: "R-1-DV", prjId: "PRJ-0001", reqId: "R-1", stage: "DV", userId: "dev01", workDt: D, reduceH: 1, add: { A1: 2, A5: 0.5 }, memo: "" };

function data(confs: DayConf[] = []): MeasureData {
  return { projects: [mkProject({ reqs: [req] })], efforts: [effort], confs, sessions: [session], settings };
}

describe("cell", () => {
  it("AI 도구 내 = 수집 − 감소, 투입 = 내 + 외", () => {
    const c = cellOf(buildIndex(data()), "R-1-DV", D);
    expect(c).toMatchObject({ ai: 4, mn: 1, inT: 3, out: 2.5, tot: 5.5, aiCost: 40000 });
  });

  it("감소는 수집값을 넘지 않는다", () => {
    const ix = buildIndex({ ...data(), efforts: [{ ...effort, reduceH: 9 }] });
    expect(cellOf(ix, "R-1-DV", D)).toMatchObject({ mn: 4, inT: 0 });
  });
});

describe("확정·집계", () => {
  it("확정 전에는 결과(confirmedOnly)에 안 들어가고 진척에는 들어간다", () => {
    const ix = buildIndex(data());
    const u = ix.units;
    expect(aggUnits(ix, u, true).tot).toBe(0);
    expect(aggUnits(ix, u, false).tot).toBe(5.5);
    expect(rowsOf(ix, "dev01", req)[0].st).toBe("need");
  });

  it("확정 후 지표 — 절감률·순절감률·AI 활용률", () => {
    const ix0 = buildIndex(data());
    const conf: DayConf = { userId: "dev01", prjId: "PRJ-0001", reqId: "R-1", workDt: D, state: "CONF", confirmedAt: "", revCount: 0, snap: daySnap(ix0, "dev01", req, D) };
    const ix = buildIndex(data([conf]));
    const a = aggUnits(ix, ix.units, true);
    expect(a.md).toBeCloseTo(5.5 / 8);
    expect(a.save).toBeCloseTo((2 - 5.5 / 8) / 2);
    expect(a.baseCost).toBe(800000);
    expect(a.labor).toBeCloseTo((5.5 / 8) * 400000);
    expect(a.aiCost).toBe(40000);
    expect(a.net).toBeCloseTo((800000 - (5.5 / 8) * 400000 - 40000) / 800000);
    expect(a.use).toBeCloseTo(3 / 5.5);
    expect(a.byType.A1).toBe(2);
    expect(confirmedSum(ix, "dev01", req)).toMatchObject({ tot: 5.5, md: 5.5 / 8 });
  });

  it("확정 뒤 수집값이 늦게 들어오면 재확정 필요가 되고 집계에서 빠진다", () => {
    const ix0 = buildIndex(data());
    const conf: DayConf = { userId: "dev01", prjId: "PRJ-0001", reqId: "R-1", workDt: D, state: "CONF", confirmedAt: "", revCount: 0, snap: daySnap(ix0, "dev01", req, D) };
    const late: StoredSession = { ...session, datId: "A|2", sessionId: "s2", minutes: 30 };
    const ix = buildIndex({ ...data([conf]), sessions: [session, late] });
    expect(rowsOf(ix, "dev01", req)[0]).toMatchObject({ st: "edit", changed: true });
    expect(aggUnits(ix, ix.units, true).tot).toBe(0);
  });

  it("기준 공수가 0 이면 비율은 null", () => {
    const r0 = { ...req, stages: [{ ...req.stages[0], baseMd: 0 }] };
    const ix = buildIndex({ ...data(), projects: [mkProject({ reqs: [r0] })] });
    expect(aggUnits(ix, ix.units, false).save).toBeNull();
  });
});
