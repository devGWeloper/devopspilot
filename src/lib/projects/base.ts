import type { Project, ProjectBase, ProjectBaseline } from "../types";

export function emptyBaseline(): ProjectBaseline {
  return {
    startDate: null,
    endDate: null,
    totalMm: null,
    phaseMm: { ANALYSIS: null, DESIGN: null, DEV: null, TEST: null },
    screens: null,
    programs: null,
    loc: null,
    replayPhases: ["DESIGN", "DEV", "TEST"],
  };
}

export function emptyBase(): ProjectBase {
  return {
    domainCd: "",
    orgNm: "",
    sysGradeCd: "",
    sysTypeCd: "",
    workAreaCd: "",
    langCds: [],
    techStack: "",
    description: "",
    llmTypeCd: "",
    aiToolCd: "",
    aiAccounts: null,
    llmModel: "",
    aiPlanCd: "",
    tokenCd: "",
    fitEvaluator: "",
    pmFit: "",
    pmFitReason: "",
    staffNms: "",
    remark: "",
    baseline: emptyBaseline(),
  };
}

// 양식이 바뀌기 전에 저장된 과제(BASE_JSON)에는 새 항목 키가 없다. 화면이 빈 값으로 다룰 수 있게 읽을 때 채운다.
export function normalizeBase(b: Partial<ProjectBase> | null | undefined): ProjectBase {
  const e = emptyBase();
  const x = b ?? {};
  return { ...e, ...x, langCds: Array.isArray(x.langCds) ? x.langCds : [], baseline: { ...e.baseline, ...(x.baseline ?? {}) } };
}

export function withBase(p: Project): Project {
  return { ...p, base: normalizeBase(p.base) };
}
