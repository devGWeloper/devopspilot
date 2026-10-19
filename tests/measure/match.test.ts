import { describe, it, expect } from "vitest";
import { allocate, extractHints, matchSession, OFF_HINT, type StoredSession } from "@/lib/measure/match";
import { unitsOf } from "@/lib/measure/units";
import { mkProject, mkReq, mkStage } from "../helpers";

const projects = [
  mkProject({
    prjId: "DAE01",
    reqs: [
      mkReq({ reqId: "REQ0051", stages: [mkStage({ cd: "DS", ownerId: "dev01" }), mkStage({ cd: "DV", ownerId: "dev01" })] }),
      mkReq({ reqId: "REQ0047", stages: [mkStage({ cd: "AN", ownerId: "dev02" }), mkStage({ cd: "DV", ownerId: "dev01" })] }),
      mkReq({ reqId: "REQ0033", stages: [mkStage({ cd: "DV", ownerId: "dev02" })] }),
      mkReq({ reqId: "REQ0012", stages: [mkStage({ cd: "DV", ownerId: "dev01", done: true })] }),
    ],
  }),
  mkProject({ prjId: "LMS03", reqs: [mkReq({ reqId: "REQ0051", stages: [mkStage({ cd: "TS", ownerId: "dev01" })] })] }),
];
const units = unitsOf(projects);
const sess = (hints: string[], p: Partial<StoredSession> = {}): StoredSession => ({
  datId: "A|1",
  src: "OTEL",
  sessionId: "s1",
  userId: "dev01",
  workDt: "2026-11-10",
  tool: "Codex",
  minutes: 60,
  start: "09:00",
  end: "10:00",
  branch: "",
  hints,
  resolution: null,
  ...p,
});

describe("matchSession", () => {
  it("공수 태그가 내 것 하나면 자동 배정", () => {
    expect(matchSession(sess(extractHints("feature/DAE01-REQ0051-DV")), units).unit).toBe("DAE01-REQ0051-DV");
  });

  it("과제ID-요구사항ID 만 있고 내 단계가 하나면 그 단계", () => {
    expect(matchSession(sess(["DAE01-REQ0047"]), units).unit).toBe("DAE01-REQ0047-DV");
  });

  it("요구사항 ID 만 적었는데 여러 과제에 있으면 후보만", () => {
    const m = matchSession(sess(["REQ0051"]), units);
    expect(m.unit).toBeNull();
    expect(m.why).toContain("여러 과제");
  });

  it("요구사항 ID 만 적었고 내 담당 중 하나뿐이면 배정", () => {
    expect(matchSession(sess(["REQ0047"]), units).unit).toBe("DAE01-REQ0047-DV");
  });

  it("요구사항에 내 단계가 여럿이면 후보만 (확인 필요)", () => {
    const m = matchSession(sess(["DAE01-REQ0051"]), units);
    expect(m.unit).toBeNull();
    expect(m.cands).toEqual(["DAE01-REQ0051-DS", "DAE01-REQ0051-DV"]);
  });

  it("남의 태그를 적었으면 내 다른 단계로 넘겨짚지 않는다", () => {
    const m = matchSession(sess(extractHints("DAE01-REQ0047-AN")), units);
    expect(m.unit).toBeNull();
    expect(m.why).toContain("다른 담당자");
  });

  it("세션 첫 줄의 짧은 단계 코드(요구사항ID-단계)도 내 담당 하나면 배정", () => {
    expect(matchSession(sess(extractHints("poc REQ0051-DS 화면 설계 시작")), units).unit).toBe("DAE01-REQ0051-DS");
    expect(matchSession(sess(extractHints("REQ0047-DV")), units).unit).toBe("DAE01-REQ0047-DV");
  });

  it("짧은 단계 코드가 남의 단계면 넘겨짚지 않는다", () => {
    expect(matchSession(sess(extractHints("REQ0047-AN")), units).unit).toBeNull();
  });

  it("poc off 는 업무 외 사용, 코드와 함께 있으면 확인 필요", () => {
    expect(extractHints("poc off")).toEqual([OFF_HINT]);
    expect(matchSession(sess(extractHints("POC OFF 개인 공부")), units)).toMatchObject({ unit: null, off: true });
    const m = matchSession(sess(extractHints("poc off DAE01-REQ0051-DV")), units);
    expect(m.off).toBeFalsy();
    expect(m.unit).toBeNull();
    expect(m.why).toContain("업무 외");
  });

  it("측정 완료 태그도 자동 배정, 정보 없으면 확인 필요", () => {
    expect(matchSession(sess(["DAE01-REQ0012"]), units).unit).toBe("DAE01-REQ0012-DV");
    expect(matchSession(sess([]), units).why).toContain("요구사항 정보 없음");
  });
});

describe("allocate", () => {
  it("자동·배정·업무 외·미정을 나누고, 나눠 배정하면 비용도 분 비율로", () => {
    const a = allocate(
      [
        sess(["DAE01-REQ0047"], { datId: "a" }),
        sess([], { datId: "b", resolution: { kind: "ASSIGN", parts: [{ unit: "DAE01-REQ0051-DS", min: 20 }, { unit: "DAE01-REQ0051-DV", min: 40 }], by: "dev01", at: "" } }),
        sess([], { datId: "c", resolution: { kind: "OFF", by: "dev01", at: "" } }),
        sess([], { datId: "d" }),
      ],
      units,
      (s) => (s.datId === "a" ? null : 600),
    );
    expect(a.byUnitDay.get("DAE01-REQ0047-DV|2026-11-10")).toEqual({ min: 60, cost: 0, na: 1 });
    expect(a.byUnitDay.get("DAE01-REQ0051-DS|2026-11-10")).toEqual({ min: 20, cost: 200, na: 0 });
    expect(a.offCount).toBe(1);
    expect(a.pending.map((p) => p.session.datId)).toEqual(["d"]);
    expect(Array.from(a.auto)).toEqual(["a"]);
  });
});

describe("extractHints", () => {
  it("태그에서 태그·reqKey·요구사항 ID 를 모두 뽑는다", () => {
    expect(extractHints("feature/dae01-req0047-dv 작업")).toEqual(["DAE01-REQ0047-DV", "DAE01-REQ0047", "REQ0047-DV", "DAE01", "REQ0047"]);
  });
  it("하이픈 있는 ID 형식(REQ-0047)도 후보가 된다", () => {
    expect(extractHints("DAE01-REQ-0047-DV")).toContain("REQ-0047");
  });
  it("숫자 없는 단어는 버리고 20개까지만", () => {
    expect(extractHints("please fix the bug")).toEqual([]);
    expect(extractHints(Array.from({ length: 30 }, (_, i) => `A${i}-B${i}`).join(" "))).toHaveLength(20);
  });
});
