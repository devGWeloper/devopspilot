import { describe, it, expect } from "vitest";
import { defaultCriteria } from "@/lib/criteria/defaults";
import { evaluateFit, reconcileAnswers, buildProfile, deriveColumns } from "@/lib/fitness";
import { emptyBase } from "@/lib/projects/base";
import type { Criteria, Indicator, Level } from "@/lib/types";

const pick = (ind: { options: { id: string; level: Level }[] }, lv: Level) =>
  (ind.options.find((o) => o.level === lv) ?? ind.options[0]).id;

function hml(id: string, tier: Indicator["tier"]): Indicator {
  return {
    id,
    name: id,
    tier,
    description: "",
    options: [
      { id: "h", label: "좋음", level: "H" },
      { id: "m", label: "보통", level: "M" },
      { id: "l", label: "나쁨", level: "L" },
    ],
  };
}

// 규칙 엔진 자체는 지표 구성과 무관하므로 Major 8·Minor 2 의 가상 기준으로 검증한다.
const g: Criteria = {
  version: 1,
  publishedAt: null,
  publishedBy: null,
  rule: { lowMinMajorLow: 2, highMaxMajorLow: 0, highMinMajorHigh: "half" },
  areas: [
    { id: "a", name: "A", question: "", indicators: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => hml(`m${n}`, "MAJOR")) },
    { id: "b", name: "B", question: "", indicators: [hml("n1", "MINOR"), hml("n2", "MINOR")] },
  ],
};
const gMajors = g.areas[0].indicators;
const gMinors = g.areas[1].indicators;

function answer(majorLevels: Level[], minorLevel: Level = "H") {
  const a: Record<string, string> = {};
  gMajors.forEach((m, i) => (a[m.id] = pick(m, majorLevels[i])));
  gMinors.forEach((m) => (a[m.id] = pick(m, minorLevel)));
  return a;
}

describe("evaluateFit — 규칙 엔진", () => {
  it("Major 하 0개 + 상 과반(5/8) → 상", () => {
    expect(evaluateFit(g, answer(["H", "H", "H", "H", "H", "M", "M", "M"])).suggest).toBe("H");
  });

  it("Major 상이 정확히 절반(4/8) → 중", () => {
    expect(evaluateFit(g, answer(["H", "H", "H", "H", "M", "M", "M", "M"])).suggest).toBe("M");
  });

  it("Major 하 1개 → 중, 하 2개 → 하", () => {
    expect(evaluateFit(g, answer(["H", "H", "H", "H", "H", "H", "H", "L"])).suggest).toBe("M");
    expect(evaluateFit(g, answer(["H", "H", "H", "H", "H", "H", "L", "L"])).suggest).toBe("L");
  });

  it("Minor 가 전부 하여도 제안은 그대로이고 보완 신호에 나온다", () => {
    const r = evaluateFit(g, answer(["H", "H", "H", "H", "H", "M", "M", "M"], "L"));
    expect(r.suggest).toBe("H");
    expect(r.minorLows).toEqual(["n1", "n2"]);
  });

  it("Minor 미응답이어도 Major 가 다 있으면 판정한다", () => {
    const a = answer(["H", "H", "H", "H", "H", "H", "H", "H"]);
    for (const m of gMinors) delete a[m.id];
    expect(evaluateFit(g, a).suggest).toBe("H");
  });

  it("Major 하나라도 미응답·없는 선택지 → 미평가", () => {
    const a = answer(["H", "H", "H", "H", "H", "H", "H", "H"]);
    delete a.m1;
    expect(evaluateFit(g, a).suggest).toBe("NA");
    expect(evaluateFit(g, a).ruleText).toContain("미응답");
    expect(evaluateFit(g, { ...answer(["H", "H", "H", "H", "H", "H", "H", "H"]), m1: "nope" }).suggest).toBe("NA");
  });

  it("상 기준: 숫자 지정 / 모두", () => {
    expect(evaluateFit({ ...g, rule: { ...g.rule, highMinMajorHigh: 3 } }, answer(["H", "H", "H", "M", "M", "M", "M", "M"])).suggest).toBe("H");
    const all = { ...g, rule: { ...g.rule, highMinMajorHigh: "all" as const } };
    expect(evaluateFit(all, answer(["H", "H", "H", "H", "H", "H", "H", "M"])).suggest).toBe("M");
    expect(evaluateFit(all, answer(["H", "H", "H", "H", "H", "H", "H", "H"])).suggest).toBe("H");
  });

  it("규칙 문장에 근거 건수가 들어간다", () => {
    expect(evaluateFit(g, answer(["H", "H", "H", "H", "H", "M", "M", "M"])).ruleText).toBe("Major 8개 중 하 0개, 상 5개 → 상");
  });

  it("Major 지표가 없는 기준은 미평가", () => {
    const c2: Criteria = { ...g, areas: g.areas.map((a) => ({ ...a, indicators: a.indicators.map((i) => ({ ...i, tier: "MINOR" as const })) })) };
    expect(evaluateFit(c2, answer(["H", "H", "H", "H", "H", "H", "H", "H"])).suggest).toBe("NA");
  });
});

describe("evaluateFit — 과제 선정 양식 기본 규칙 (FIT-05)", () => {
  const c = defaultCriteria();
  const a = (spec: string, context: string, pattern: string) => ({ spec, context, pattern });

  it("셋 다 유리 → 상, 병목 없음", () => {
    const r = evaluateFit(c, a("clear", "able", "repeat"));
    expect(r.suggest).toBe("H");
    expect(r.bottleneck).toEqual([]);
  });

  it("최저가 중간 → 중, 병목은 중간인 항목", () => {
    const r = evaluateFit(c, a("clear", "partial", "variant"));
    expect(r.suggest).toBe("M");
    expect(r.bottleneck).toEqual(["맥락 주입 가능성", "생성 패턴"]);
  });

  it("하나라도 불리 → 하, 병목은 불리한 항목", () => {
    const r = evaluateFit(c, a("clear", "able", "design"));
    expect(r.suggest).toBe("L");
    expect(r.bottleneck).toEqual(["생성 패턴"]);
  });

  it("도구·인력(Minor)은 등급을 바꾸지 않는다", () => {
    const r = evaluateFit(c, { ...a("clear", "able", "repeat"), wbs: "no", vcs: "none", aiExp: "none" });
    expect(r.suggest).toBe("H");
    expect(r.minorLows).toEqual(["기존 WBS 실적", "버전관리 도구", "AI 활용 개발 경험"]);
  });
});

describe("reconcileAnswers", () => {
  it("기준에서 사라진 지표·선택지 응답과 메모를 버린다", () => {
    const r = reconcileAnswers(g, { m1: "h", gone: "x", m2: "nope" }, { m1: "memo", gone: "n" });
    expect(r.answers).toEqual({ m1: "h" });
    expect(r.notes).toEqual({ m1: "memo" });
  });
});

describe("buildProfile", () => {
  it("지표 순서대로, 미응답은 null, 응답은 수준과 라벨", () => {
    const c = defaultCriteria();
    const p = buildProfile(c, { spec: "vague" });
    expect(p).toHaveLength(c.areas.flatMap((x) => x.indicators).length);
    expect(p[0]).toMatchObject({ indicatorId: "spec", areaId: "fit", tier: "MAJOR", level: "L", optionLabel: "모호" });
    expect(p.slice(1).every((x) => x.level === null)).toBe(true);
  });
});

describe("deriveColumns", () => {
  const c = defaultCriteria();
  const base = { ...emptyBase(), domainCd: "MES", sysTypeCd: "WEB_CLOUD", workAreaCd: "IMPROVE", langCds: ["JAVA", "PLSQL"] };

  it("확정이 없으면 finalFit NA, 분류 컬럼은 양식 값에서", () => {
    const d = deriveColumns(c, { base, eval: { answers: { spec: "clear", context: "able", pattern: "repeat" }, notes: {}, confirm: null } });
    expect(d).toMatchObject({
      suggestFit: "H",
      finalFit: "NA",
      mainLangCd: "JAVA",
      domainCd: "MES",
      sysTypeCd: "WEB_CLOUD",
      devTypeCd: "IMPROVE",
      answerCnt: 3,
      critVer: 1,
    });
  });

  it("확정이 있으면 finalFit 은 확정값", () => {
    const d = deriveColumns(c, { base, eval: { answers: {}, notes: {}, confirm: { fit: "L", reason: "r", by: "a", byNm: "A", at: "t" } } });
    expect(d.finalFit).toBe("L");
    expect(d.suggestFit).toBe("NA");
  });
});
