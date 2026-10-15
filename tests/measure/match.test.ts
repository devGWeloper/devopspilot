import { describe, it, expect } from "vitest";
import { allocate, extractHints, matchSession, type StoredSession } from "@/lib/measure/match";
import { unitsOf } from "@/lib/measure/units";
import { mkProject, mkReq, mkStage } from "../helpers";

const projects = [
  mkProject({
    reqs: [
      mkReq({ reqId: "REQ-0051", stages: [mkStage({ cd: "DS", ownerId: "dev01" }), mkStage({ cd: "DV", ownerId: "dev01" })] }),
      mkReq({ reqId: "REQ-0047", stages: [mkStage({ cd: "AN", ownerId: "dev02" }), mkStage({ cd: "DV", ownerId: "dev01" })] }),
      mkReq({ reqId: "REQ-0033", stages: [mkStage({ cd: "DV", ownerId: "dev02" })] }),
      mkReq({ reqId: "REQ-0012", done: true, stages: [mkStage({ cd: "DV", ownerId: "dev01" })] }),
    ],
  }),
];
const units = unitsOf(projects);
const sess = (hints: string[], p: Partial<StoredSession> = {}): StoredSession => ({
  datId: "A|1",
  src: "OTEL",
  sessionId: "s1",
  userId: "dev01",
  workDt: "2026-11-10",
  tool: "Claude Code",
  minutes: 60,
  start: "09:00",
  end: "10:00",
  branch: "",
  hints,
  resolution: null,
  ...p,
});

describe("matchSession", () => {
  it("내 단계 코드가 하나면 자동 배정", () => {
    expect(matchSession(sess(["REQ-0051-DV", "REQ-0051"]), units).unit).toBe("REQ-0051-DV");
  });

  it("요구사항 ID 만 있고 내 단계가 하나면 그 단계", () => {
    expect(matchSession(sess(["REQ-0047"]), units).unit).toBe("REQ-0047-DV");
  });

  it("요구사항에 내 단계가 여럿이면 후보만 (확인 필요)", () => {
    const m = matchSession(sess(["REQ-0051"]), units);
    expect(m.unit).toBeNull();
    expect(m.cands).toEqual(["REQ-0051-DS", "REQ-0051-DV"]);
  });

  it("남의 단계 코드를 적었으면 내 다른 단계로 넘겨짚지 않는다", () => {
    const m = matchSession(sess(["REQ-0047-AN", "REQ-0047"]), units);
    expect(m.unit).toBeNull();
    expect(m.why).toContain("다른 담당자");
  });

  it("측정 완료 요구사항도 자동 배정, 정보 없으면 확인 필요", () => {
    expect(matchSession(sess(["REQ-0012"]), units).unit).toBe("REQ-0012-DV");
    expect(matchSession(sess([]), units).why).toContain("요구사항 정보 없음");
  });
});

describe("allocate", () => {
  it("자동·배정·업무 외·미정을 나눈다", () => {
    const a = allocate(
      [
        sess(["REQ-0047"], { datId: "a" }),
        sess(["REQ-0051"], { datId: "b", resolution: { kind: "ASSIGN", parts: [{ unit: "REQ-0051-DS", min: 20 }, { unit: "REQ-0051-DV", min: 40 }], by: "dev01", at: "" } }),
        sess([], { datId: "c", resolution: { kind: "OFF", by: "dev01", at: "" } }),
        sess([], { datId: "d" }),
      ],
      units,
      () => 6000,
    );
    expect(a.byUnitDay.get("REQ-0047-DV|2026-11-10")).toEqual({ min: 60, cost: 6000 });
    expect(a.byUnitDay.get("REQ-0051-DS|2026-11-10")?.min).toBe(20);
    expect(a.offCount).toBe(1);
    expect(a.pending.map((p) => p.session.datId)).toEqual(["d"]);
  });
});

it("extractHints: 단계 코드와 요구사항 ID 를 함께 뽑는다", () => {
  expect(extractHints("feature/req-0047-dv 작업, MES-12 참고")).toEqual(["REQ-0047-DV", "REQ-0047", "MES-12"]);
});
