import { emptyBase } from "@/lib/projects/base";
import type { Project, ProjectBase } from "@/lib/types";

export function mkProject(partial: Partial<Project> = {}): Project {
  return {
    prjId: "PRJ-0001",
    prjNm: "과제",
    sysNm: "시스템",
    pmUserId: "pm01",
    pmUserNm: "PM",
    status: "DRAFT",
    statusNote: null,
    devTypeCd: null,
    mainLangCd: null,
    domainCd: null,
    sysTypeCd: null,
    answerCnt: 0,
    indicatorCnt: 8,
    suggestFit: "NA",
    finalFit: "NA",
    aiFit: null,
    axAgree: "NONE",
    hxAgree: "NONE",
    critVer: 1,
    base: { ...emptyBase(), baseline: { ...emptyBase().baseline, replayPhases: [] } },
    eval: { answers: {}, notes: {}, confirm: null },
    reviews: [],
    ai: null,
    regUserId: "pm01",
    regAt: "2026-10-01T00:00:00.000Z",
    updUserId: "pm01",
    updAt: "2026-10-01T00:00:00.000Z",
    ...partial,
  };
}

// 양식의 필수 항목을 모두 채운 기본 정보. 제출 가능한 과제를 만들 때 쓴다.
export function filledBase(): ProjectBase {
  return {
    ...emptyBase(),
    domainCd: "MES",
    orgNm: "FAB MOS",
    sysGradeCd: "L2",
    sysTypeCd: "WEB_CLOUD",
    workAreaCd: "IMPROVE",
    langCds: ["JAVA"],
    description: "설명",
    llmTypeCd: "PUBLIC",
    aiToolCd: "CLAUDE_CODE",
    aiAccounts: 2,
    pmFit: "H",
    pmFitReason: "패턴 반복 위주",
    staffNms: "김개발",
    baseline: {
      ...emptyBase().baseline,
      startDate: "2025-01-01",
      endDate: "2025-06-30",
      totalMm: 6,
      replayPhases: ["DEV"],
    },
  };
}
