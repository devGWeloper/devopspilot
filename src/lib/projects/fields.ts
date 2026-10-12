import type { Codes, Criteria, ProjectBase } from "../types";

export const ENTRY_STEPS = ["과제 정보", "원 프로젝트 실적", "AI 적용 계획", "AI 적합도", "참여 인력"] as const;
export const STEP = { PROJECT: 0, BASELINE: 1, PLAN: 2, FIT: 3, STAFF: 4 } as const;

export type CodeListKey = Exclude<keyof Codes, "target">;

export const CODE_LISTS: { key: CodeListKey; ref: string; title: string }[] = [
  { key: "domains", ref: "PRJ-03", title: "담당" },
  { key: "sysGrades", ref: "PRJ-06", title: "시스템 등급" },
  { key: "sysTypes", ref: "PRJ-07", title: "배포 형식" },
  { key: "workAreas", ref: "PRJ-08", title: "과제 영역" },
  { key: "langs", ref: "ADD-01", title: "주 개발 언어" },
  { key: "llmTypes", ref: "AIS-01", title: "LLM 구분" },
  { key: "aiTools", ref: "AIS-02", title: "AI 도구" },
  { key: "aiPlans", ref: "AIS-05", title: "요금제" },
  { key: "tokenRanges", ref: "AIS-06", title: "예상 토큰량" },
];

type BaseKey = Exclude<keyof ProjectBase, "baseline">;

export interface EntryField {
  ref: string;
  key: "prjNm" | "sysNm" | BaseKey;
  name: string;
  step: number;
  section: string;
  kind: "text" | "textarea" | "code" | "codes" | "number" | "level";
  required: boolean;
  guide?: string;
  codes?: CodeListKey;
  placeholder?: string;
  max?: number;
  // 양식에 없는 항목. 언어별 균형 점검·Replay 범위 설명처럼 포털 기능이 기대는 값이라 남겨 둔다.
  portal?: boolean;
}

// 과제 선정 양식(엑셀) '항목정의' 시트의 과제 단위 항목. 요구사항(REQ-*) 은 과제 기준 선정이라 받지 않는다.
export const ENTRY_FIELDS: EntryField[] = [
  { ref: "PRJ-01", key: "prjNm", name: "과제명", step: 0, section: "기본 정보", kind: "text", required: true, max: 200, placeholder: "예) 설비 상태 조회 화면 고도화" },
  { ref: "PRJ-02", key: "sysNm", name: "대상 시스템명", step: 0, section: "기본 정보", kind: "text", required: true, max: 200, guide: "변경 대상 주 시스템", placeholder: "예) smartMES" },
  { ref: "PRJ-03", key: "domainCd", name: "담당", step: 0, section: "기본 정보", kind: "code", codes: "domains", required: true, guide: "하이닉스 담당" },
  { ref: "PRJ-04", key: "orgNm", name: "담당 팀", step: 0, section: "기본 정보", kind: "text", required: true, max: 100, guide: "담당 산하 팀명", placeholder: "예) FAB MOS" },
  { ref: "PRJ-06", key: "sysGradeCd", name: "시스템 등급", step: 0, section: "시스템 특성", kind: "code", codes: "sysGrades", required: true, guide: "고객사 시스템 등급 기준 (L0 최상위)" },
  {
    ref: "PRJ-07",
    key: "sysTypeCd",
    name: "배포 형식",
    step: 0,
    section: "시스템 특성",
    kind: "code",
    codes: "sysTypes",
    required: true,
    guide: "실행·배포 구조. Agent 가 결과를 직접 확인할 수 있는 범위와 연관되므로 배포 형식별로 균등하게 선정합니다.",
  },
  { ref: "PRJ-08", key: "workAreaCd", name: "과제 영역", step: 0, section: "시스템 특성", kind: "code", codes: "workAreas", required: true, guide: "기존(레거시) 시스템이 있는지, 어떤 방식으로 바꾸는지" },
  { ref: "ADD-01", key: "langCds", name: "주 개발 언어", step: 0, section: "시스템 특성", kind: "codes", codes: "langs", required: true, portal: true, guide: "여러 개 선택할 수 있고, 처음 선택한 언어가 주 언어로 집계됩니다." },
  { ref: "ADD-02", key: "techStack", name: "프레임워크·기술 스택", step: 0, section: "시스템 특성", kind: "text", required: false, portal: true, max: 500, placeholder: "예) Spring Boot, React, Oracle" },
  { ref: "ADD-03", key: "description", name: "과제 설명", step: 0, section: "시스템 특성", kind: "textarea", required: false, portal: true, max: 4000, guide: "무엇을 만든(고친) 과제인지, Replay 대상 범위가 어디인지" },

  { ref: "AIS-01", key: "llmTypeCd", name: "LLM 구분", step: 2, section: "도구", kind: "code", codes: "llmTypes", required: true, guide: "1차로 Public(외부) LLM 을 쓸지 사내 LLM 을 쓸지 결정" },
  { ref: "AIS-02", key: "aiToolCd", name: "AI 도구", step: 2, section: "도구", kind: "code", codes: "aiTools", required: true, guide: "LLM 구분에 맞춰 사용할 AI 코딩 도구" },
  { ref: "AIS-03", key: "aiAccounts", name: "필요 계정 수", step: 2, section: "도구", kind: "number", required: true, guide: "이 과제를 수행할 인원 기준 AI 도구 계정 수 (계정·크레딧 요청 근거)" },
  { ref: "AIS-04", key: "llmModel", name: "LLM 모델", step: 2, section: "모델·비용 (참고)", kind: "text", required: false, max: 100, guide: "모델명·버전 (참고용)" },
  { ref: "AIS-05", key: "aiPlanCd", name: "요금제", step: 2, section: "모델·비용 (참고)", kind: "code", codes: "aiPlans", required: false, guide: "필요 요금제 수준 (참고용)" },
  { ref: "AIS-06", key: "tokenCd", name: "예상 토큰량", step: 2, section: "모델·비용 (참고)", kind: "code", codes: "tokenRanges", required: false, guide: "과제 수행 시 예상 토큰 (참고용)" },

  { ref: "FIT-04", key: "fitEvaluator", name: "평가자 (개발자)", step: 3, section: "개발자 평가", kind: "text", required: false, max: 100, guide: "FIT-01~03 을 평가한 개발자" },
  { ref: "FIT-06", key: "pmFit", name: "예상 기대효과", step: 3, section: "PM 판단", kind: "level", required: true, guide: "참고 등급과 평가를 보고 PM 이 최종 판단" },
  { ref: "FIT-07", key: "pmFitReason", name: "판단 사유", step: 3, section: "PM 판단", kind: "textarea", required: true, max: 1000, guide: "한두 문장. 병목 항목을 근거로 작성" },

  { ref: "REF-01", key: "staffNms", name: "참여 인력 (AX)", step: 4, section: "인력 (AX)", kind: "text", required: true, max: 300, guide: "PoC 를 수행할 AX 인력 성명 (여러 명이면 쉼표로 구분)" },
  { ref: "REF-04", key: "remark", name: "비고", step: 4, section: "관리", kind: "textarea", required: false, max: 2000, guide: "'기타'·'복합'·'혼합' 선택 시 내용 기재" },
];

// FIT-06 선택지. 판정 수준(상·중·하)과 같은 값이라 코드 목록이 아니라 고정 정의로 둔다.
export const PM_FIT_HINT: Record<"H" | "M" | "L", string> = {
  H: "AI 적용으로 공수가 크게 줄 것으로 예상",
  M: "일부 단계·작업에서만 줄 것으로 예상",
  L: "효과가 거의 없거나 검토·보완으로 오히려 늘 수 있음",
};

const AREA_STEP: Record<string, number> = { tools: STEP.PROJECT, staff: STEP.STAFF };

// 관리자가 새로 만든 영역은 따로 둘 자리가 없어 적합도 단계에 함께 묻는다.
export function stepOfArea(areaId: string): number {
  return AREA_STEP[areaId] ?? STEP.FIT;
}

export function areasOfStep(c: Criteria, step: number) {
  return c.areas.filter((a) => stepOfArea(a.id) === step);
}

export function fieldsOfStep(step: number): EntryField[] {
  return ENTRY_FIELDS.filter((f) => f.step === step);
}

export function sectionsOf(fields: EntryField[]): [string, EntryField[]][] {
  const m = new Map<string, EntryField[]>();
  for (const f of fields) m.set(f.section, [...(m.get(f.section) ?? []), f]);
  return [...m.entries()];
}
