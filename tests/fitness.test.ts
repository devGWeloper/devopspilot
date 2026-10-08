import { describe, it, expect } from "vitest";
import { defaultCriteria } from "@/lib/criteria/defaults";
import { evaluateFit, reconcileAnswers, buildProfile, deriveColumns } from "@/lib/fitness";
import type { Criteria, Level, ProjectBase } from "@/lib/types";

const c = defaultCriteria();
const all = c.areas.flatMap((a) => a.indicators);
const majors = all.filter((i) => i.tier === "MAJOR");
const minors = all.filter((i) => i.tier === "MINOR");
const pick = (ind: { options: { id: string; level: Level }[] }, lv: Level) =>
  (ind.options.find((o) => o.level === lv) ?? ind.options[0]).id;

function answer(majorLevels: Level[], minorLevel: Level = "H") {
  const a: Record<string, string> = {};
  majors.forEach((m, i) => (a[m.id] = pick(m, majorLevels[i])));
  minors.forEach((m) => (a[m.id] = pick(m, minorLevel)));
  return a;
}

describe("evaluateFit", () => {
  it("Major 하 0개 + 상 과반(5/8) → 상", () => {
    expect(evaluateFit(c, answer(["H", "H", "H", "H", "H", "M", "M", "M"])).suggest).toBe("H");
  });

  it("Major 상이 정확히 절반(4/8) → 중", () => {
    expect(evaluateFit(c, answer(["H", "H", "H", "H", "M", "M", "M", "M"])).suggest).toBe("M");
  });

  it("Major 하 1개 → 중", () => {
    expect(evaluateFit(c, answer(["H", "H", "H", "H", "H", "H", "H", "L"])).suggest).toBe("M");
  });

  it("Major 하 2개 → 하", () => {
    expect(evaluateFit(c, answer(["H", "H", "H", "H", "H", "H", "L", "L"])).suggest).toBe("L");
  });

  it("Minor 가 전부 하여도 제안은 그대로이고 보완 신호에 나온다", () => {
    const r = evaluateFit(c, answer(["H", "H", "H", "H", "H", "M", "M", "M"], "L"));
    expect(r.suggest).toBe("H");
    expect(r.minorLows.length).toBeGreaterThan(0);
  });

  it("Minor 미응답이어도 Major 가 다 있으면 판정한다", () => {
    const a = answer(["H", "H", "H", "H", "H", "H", "H", "H"]);
    for (const m of minors) delete a[m.id];
    expect(evaluateFit(c, a).suggest).toBe("H");
  });

  it("Major 하나라도 미응답 → 미평가", () => {
    const a = answer(["H", "H", "H", "H", "H", "H", "H", "H"]);
    delete a[majors[0].id];
    const r = evaluateFit(c, a);
    expect(r.suggest).toBe("NA");
    expect(r.ruleText).toContain("미응답");
  });

  it("존재하지 않는 선택지 id 는 미응답 취급", () => {
    const a = answer(["H", "H", "H", "H", "H", "H", "H", "H"]);
    a[majors[0].id] = "nope";
    expect(evaluateFit(c, a).suggest).toBe("NA");
  });

  it("규칙 값 변경 반영 (lowMinMajorLow=1)", () => {
    const c2: Criteria = { ...c, rule: { ...c.rule, lowMinMajorLow: 1 } };
    expect(evaluateFit(c2, answer(["H", "H", "H", "H", "H", "H", "H", "L"])).suggest).toBe("L");
  });

  it("상 기준을 숫자로 지정 (highMinMajorHigh=3)", () => {
    const c2: Criteria = { ...c, rule: { ...c.rule, highMinMajorHigh: 3 } };
    expect(evaluateFit(c2, answer(["H", "H", "H", "M", "M", "M", "M", "M"])).suggest).toBe("H");
  });

  it("규칙 문장에 근거 건수가 들어간다", () => {
    const r = evaluateFit(c, answer(["H", "H", "H", "H", "H", "M", "M", "M"]));
    expect(r.ruleText).toBe("Major 8개 중 하 0개, 상 5개 → 상");
  });

  it("응답 수 집계", () => {
    const r = evaluateFit(c, { [majors[0].id]: pick(majors[0], "H") });
    expect(r.answerCnt).toBe(1);
    expect(r.indicatorCnt).toBe(18);
  });

  it("Major 지표가 없는 기준은 미평가", () => {
    const c2: Criteria = {
      ...c,
      areas: c.areas.map((a) => ({ ...a, indicators: a.indicators.map((i) => ({ ...i, tier: "MINOR" as const })) })),
    };
    expect(evaluateFit(c2, answer(["H", "H", "H", "H", "H", "H", "H", "H"])).suggest).toBe("NA");
  });
});

describe("reconcileAnswers", () => {
  it("기준에서 사라진 지표·선택지 응답과 메모를 버린다", () => {
    const r = reconcileAnswers(c, { devType: "new", gone: "x", risk: "nope" }, { devType: "m", gone: "n" });
    expect(r.answers).toEqual({ devType: "new" });
    expect(r.notes).toEqual({ devType: "m" });
  });
});

describe("buildProfile", () => {
  it("지표 순서대로 18칸, 미응답은 null", () => {
    const p = buildProfile(c, {});
    expect(p).toHaveLength(18);
    expect(p.every((x) => x.level === null)).toBe(true);
    expect(p[0]).toMatchObject({ indicatorId: "devType", areaId: "char", tier: "MAJOR" });
  });

  it("응답한 칸은 수준과 라벨", () => {
    const p = buildProfile(c, { devType: "legacy" });
    expect(p[0]).toMatchObject({ level: "L", optionLabel: "레거시" });
  });
});

describe("deriveColumns", () => {
  const base: ProjectBase = {
    description: "",
    domainCd: "FAB",
    sysTypeCd: "WEB",
    langCds: ["JAVA", "PLSQL"],
    techStack: "",
    orgNm: "",
    baseline: {
      startDate: null,
      endDate: null,
      totalMm: null,
      phaseMm: { ANALYSIS: null, DESIGN: null, DEV: null, TEST: null },
      screens: null,
      programs: null,
      loc: null,
      replayPhases: [],
    },
  };

  it("확정이 없으면 finalFit NA, 분류 컬럼 복제", () => {
    const d = deriveColumns(c, { base, eval: { answers: answer(["H", "H", "H", "H", "H", "M", "M", "M"]), notes: {}, confirm: null } });
    expect(d).toMatchObject({
      suggestFit: "H",
      finalFit: "NA",
      mainLangCd: "JAVA",
      domainCd: "FAB",
      sysTypeCd: "WEB",
      devTypeCd: "new",
      answerCnt: 18,
      indicatorCnt: 18,
      critVer: 1,
    });
  });

  it("확정이 있으면 finalFit 은 확정값", () => {
    const d = deriveColumns(c, {
      base,
      eval: { answers: {}, notes: {}, confirm: { fit: "L", reason: "r", by: "a", byNm: "A", at: "t" } },
    });
    expect(d.finalFit).toBe("L");
    expect(d.suggestFit).toBe("NA");
  });
});
