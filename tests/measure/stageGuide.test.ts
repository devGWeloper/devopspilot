import { it, expect } from "vitest";
import { allocate, extractHints, matchSession, type StoredSession } from "@/lib/measure/match";
import { agentsMd, stagePrompt } from "@/lib/measure/stageGuide";
import { unitsOf } from "@/lib/measure/units";
import { STAGES } from "@/lib/types";
import { mkProject, mkReq, mkStage } from "../helpers";

const units = unitsOf([mkProject({ prjId: "DAE01", reqs: [mkReq({ reqId: "REQ0047", stages: STAGES.map((cd) => mkStage({ cd, ownerId: "dev01" })) })] })]);
const sess = (text: string, datId = "A|1"): StoredSession => ({
  datId,
  src: "LOG",
  sessionId: datId,
  userId: "dev01",
  workDt: "2026-11-10",
  tool: "Codex",
  minutes: 60,
  start: "09:00",
  end: "10:00",
  branch: "",
  hints: extractHints(text),
  resolution: null,
});

it("단계 지시문을 첫 메시지로 쓰면 앞 단계 문서를 말해도 그 단계에만 붙는다", () => {
  for (const stage of STAGES) {
    const code = `DAE01-REQ0047-${stage}`;
    const text = stagePrompt({ code, reqKey: "DAE01-REQ0047", name: "알람 이력 조회", stage });
    expect(text.split("\n")[0]).toBe(`poc ${code}`);
    expect(matchSession(sess(text), units).unit).toBe(code);
  }
  expect(stagePrompt({ code: "DAE01-REQ0047-TS", reqKey: "DAE01-REQ0047", name: "", stage: "TS" })).toContain("docs/poc/DAE01-REQ0047/03_개발.md");
});

it("한 세션에 단계 코드가 둘이면 미분류 + 단계 섞임으로 남고, 직접 배정해도 섞임 표시는 유지", () => {
  const mixed = sess("poc DAE01-REQ0047-AN 분석하고 이어서 DAE01-REQ0047-DS 설계도");
  const m = matchSession(mixed, units);
  expect(m).toMatchObject({ unit: null, mixed: true });
  expect(m.why).toContain("단계마다 새 세션");
  const assigned = { ...mixed, datId: "A|2", resolution: { kind: "ASSIGN" as const, parts: [{ unit: "DAE01-REQ0047-AN", min: 60 }], by: "dev01", at: "" } };
  const a = allocate([mixed, assigned, sess("poc DAE01-REQ0047-DV", "A|3")], units, () => null);
  expect(Array.from(a.mixed).sort()).toEqual(["A|1", "A|2"]);
  expect(a.pending.map((p) => p.session.datId)).toEqual(["A|1"]);
});

it("AGENTS.md 규칙은 세션 기록에 들어가도 태그 후보·업무 외 표시를 만들지 않는다", () => {
  expect(extractHints(agentsMd())).toEqual([]);
  expect(agentsMd()).toContain("02_설계.md");
});
