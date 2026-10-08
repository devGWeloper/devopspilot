import { describe, it, expect } from "vitest";
import { buildAssessPrompt, PROMPT_TEMPLATE } from "@/lib/ai/prompt";
import { parseAssessResponse } from "@/lib/ai/parse";
import { analyzeBalance } from "@/lib/balance";
import { defaultCodes, defaultCriteria } from "@/lib/criteria/defaults";
import { sampleProjects } from "@/lib/criteria/samples";

const c = defaultCriteria();
const codes = defaultCodes();
const ps = sampleProjects(c, "2026-10-08T00:00:00.000Z");

describe("buildAssessPrompt", () => {
  const args = { consultantPrompt: "## 판정 기준\n상은 표준 패턴 위주 신규 과제", criteria: c, project: ps[0], balance: analyzeBalance(ps, c, codes), codes };

  it("컨설턴트 프롬프트·지표·출력 형식이 들어간다", () => {
    const { system, user } = buildAssessPrompt(args);
    expect(system).toContain("상은 표준 패턴 위주 신규 과제");
    expect(system).toContain('"grade"');
    for (const i of c.areas.flatMap((a) => a.indicators)) expect(user).toContain(i.name);
    expect(user).toContain(ps[0].prjNm);
    expect(user).toContain("MAJOR");
    expect(user).toContain("현재 선정 분포");
  });

  it("과제 응답을 선택지 라벨로 풀어 쓴다", () => {
    expect(buildAssessPrompt(args).user).toContain("개발 성격: 신규");
  });

  it("빈 컨설턴트 프롬프트는 거부", () => {
    expect(() => buildAssessPrompt({ ...args, consultantPrompt: "  " })).toThrow();
  });

  it("템플릿에 섹션 머리말", () => {
    for (const h of ["판정 기준", "Major 지표 해석", "선정 원칙", "주의사항"]) expect(PROMPT_TEMPLATE).toContain(h);
  });
});

describe("parseAssessResponse", () => {
  const good = { grade: "상", summary: "요약", strengths: ["a"], risks: ["b"], indicatorComments: [{ indicatorId: "devType", comment: "c" }], replayNotes: "r", balanceNote: "n" };

  it("JSON 펜스 제거, 한글 등급 정규화", () => {
    const r = parseAssessResponse("결과입니다\n```json\n" + JSON.stringify(good) + "\n```");
    expect(r.ok && r.value.grade).toBe("H");
  });

  it("영문 등급·누락된 배열 필드는 빈 배열", () => {
    const r = parseAssessResponse(JSON.stringify({ grade: "L", summary: "s" }));
    expect(r.ok && r.value).toMatchObject({ grade: "L", strengths: [], risks: [], indicatorComments: [], replayNotes: "", balanceNote: "" });
  });

  it("등급·요약 없으면 오류", () => {
    expect(parseAssessResponse(JSON.stringify({ grade: "X", summary: "s" })).ok).toBe(false);
    expect(parseAssessResponse(JSON.stringify({ grade: "중" })).ok).toBe(false);
  });

  it("깨진 JSON 은 오류", () => {
    expect(parseAssessResponse("{not json").ok).toBe(false);
  });
});
