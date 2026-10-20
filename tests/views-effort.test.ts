import { describe, it, expect } from "vitest";
import { defaultSettings } from "@/lib/measure/defaults";
import type { StoredSession } from "@/lib/measure/match";
import { buildIndex, daySnap, type MeasureData } from "@/lib/measure/metrics";
import type { DayConf, EffortEntry } from "@/lib/measure/types";
import { dashView, effortView } from "@/lib/views";
import { admin, mkProject, mkReq, mkStage, mkUser } from "./helpers";

const D1 = "2026-11-09";
const D2 = "2026-11-10";
const settings = { ...defaultSettings(), measureStart: "2026-11-01", gradePrice: { 중급: 400000 } };
const req = mkReq({
  reqId: "R1",
  name: "수신 로직",
  stages: [
    mkStage({ cd: "AN", ownerId: "dev02", ownerNm: "박개발", baseMd: 1, done: true }),
    mkStage({ cd: "DV", ownerId: "dev01", baseMd: 2, done: true }),
    mkStage({ cd: "TS", ownerId: "dev01", baseMd: 1 }),
  ],
});
const sess = (unit: string, workDt: string, minutes: number, userId = "dev01"): StoredSession => ({
  datId: `A|${unit}|${workDt}`,
  src: "OTEL",
  sessionId: unit,
  userId,
  workDt,
  tool: "Codex",
  minutes,
  start: "",
  end: "",
  branch: "",
  hints: [unit],
  resolution: null,
});
const effort: EffortEntry = { unit: "DAE01-R1-DV", prjId: "DAE01", reqId: "R1", stage: "DV", userId: "dev01", workDt: D1, reduceH: 0, add: { A1: 4 }, memo: "" };

function data(confs: DayConf[] = []): MeasureData {
  return {
    projects: [mkProject({ reqs: [req] })],
    efforts: [effort],
    confs,
    sessions: [sess("DAE01-R1-DV", D1, 12 * 60), sess("DAE01-R1-TS", D2, 120), sess("DAE01-R1-AN", D1, 240, "dev02")],
    settings,
  };
}
const users = [mkUser("dev01", "김개발"), mkUser("dev02", "박개발")];

describe("effortView — 하루 × 요구사항 × 단계", () => {
  const ix0 = buildIndex(data());
  const conf: DayConf = { userId: "dev01", prjId: "DAE01", reqId: "R1", workDt: D1, state: "CONF", confirmedAt: "x", revCount: 0, snap: daySnap(ix0, "dev01", req, D1) };
  const vm = effortView(buildIndex(data([conf])), users, "dev01", "2026-11-11");
  const r = vm.reqs[0];

  it("요구사항 줄은 내 단계만, 남의 단계는 담당자 이름으로", () => {
    expect(r.units.map((u) => u.stage)).toEqual(["DV", "TS"]);
    expect(r.others).toEqual([{ stage: "AN", ownerNm: "박개발" }]);
  });

  it("날짜 목록은 최근 7일 + 기록 있는 날, 최신부터", () => {
    expect(vm.days[0].date).toBe("2026-11-11");
    expect(vm.days.length).toBe(7);
    const d1 = vm.days.find((d) => d.date === D1)!;
    const d2 = vm.days.find((d) => d.date === D2)!;
    expect(d1.st).toEqual({ "DAE01-R1": "conf" });
    expect(d2.st).toEqual({ "DAE01-R1": "need" });
    expect(d1.cells["DAE01-R1-DV"]).toMatchObject({ ai: 12, out: 4, tot: 16 });
    expect(d1.cells["DAE01-R1-DV"].sess).toHaveLength(1);
    expect(d1.cells["DAE01-R1-AN"]).toBeUndefined();
    expect([d1.need, d2.need, d2.tot]).toEqual([0, 1, 2]);
  });

  it("요약 — 확정된 날만 Codex·직접 입력 합", () => {
    expect(vm.stats).toMatchObject({ needDays: 1, pendN: 0, confAi: 12, confOut: 4, last: { date: D2, src: "OTEL" } });
  });
});

describe("dashView — 요구사항 × 단계 기준 대비", () => {
  it("완료 단계만 숫자, 측정 중 단계는 상태만", () => {
    const ix0 = buildIndex(data());
    const confs: DayConf[] = [
      { userId: "dev01", prjId: "DAE01", reqId: "R1", workDt: D1, state: "CONF", confirmedAt: "x", revCount: 0, snap: daySnap(ix0, "dev01", req, D1) },
      { userId: "dev02", prjId: "DAE01", reqId: "R1", workDt: D1, state: "CONF", confirmedAt: "x", revCount: 0, snap: daySnap(ix0, "dev02", req, D1) },
    ];
    const vm = dashView(buildIndex(data(confs)), admin, { prjId: "", includeIng: false }, "2026-11-11T00:00:00Z");
    const row = vm.matrix[0];
    expect(row.cells.DV?.agg).toMatchObject({ baseMd: 2, md: 2 });
    expect(row.cells.AN?.agg).toMatchObject({ baseMd: 1, md: 0.5 });
    expect(row.cells.TS).toMatchObject({ status: "ING", agg: null });
    expect(row.cells.DS).toBeUndefined();
    expect(row.total).toMatchObject({ baseMd: 3, md: 2.5 });
  });
});
