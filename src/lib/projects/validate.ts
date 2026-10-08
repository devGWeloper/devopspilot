import type { Criteria, ProjectBase } from "../types";

export interface ProjectInput {
  prjNm: string;
  sysNm: string;
  pmUserId?: string;
  base: ProjectBase;
  answers: Record<string, string>;
  notes: Record<string, string>;
}

export interface FieldError {
  field: string;
  message: string;
}

const MAX = { prjNm: 200, sysNm: 200, description: 4000, techStack: 500, note: 1000 };

export function validateDraft(input: ProjectInput): FieldError[] {
  const e: FieldError[] = [];
  if (!input.prjNm?.trim()) e.push({ field: "prjNm", message: "과제명을 입력해 주세요." });
  if ((input.prjNm ?? "").length > MAX.prjNm) e.push({ field: "prjNm", message: `과제명은 ${MAX.prjNm}자 이내로 입력해 주세요.` });
  if ((input.sysNm ?? "").length > MAX.sysNm) e.push({ field: "sysNm", message: `시스템명은 ${MAX.sysNm}자 이내로 입력해 주세요.` });
  if ((input.base?.description ?? "").length > MAX.description) e.push({ field: "description", message: "과제 설명이 너무 깁니다." });
  if ((input.base?.techStack ?? "").length > MAX.techStack) e.push({ field: "techStack", message: "기술 스택이 너무 깁니다." });
  for (const [k, v] of Object.entries(input.notes ?? {})) {
    if (typeof v === "string" && v.length > MAX.note) e.push({ field: `note.${k}`, message: "메모가 너무 깁니다." });
  }
  const bl = input.base?.baseline;
  if (bl) {
    const nums = [bl.totalMm, bl.screens, bl.programs, bl.loc, ...Object.values(bl.phaseMm ?? {})];
    if (nums.some((n) => n !== null && n !== undefined && (typeof n !== "number" || !Number.isFinite(n) || n < 0))) {
      e.push({ field: "baseline", message: "실적 수치는 0 이상의 숫자여야 합니다." });
    }
    if (bl.startDate && bl.endDate && bl.startDate > bl.endDate) {
      e.push({ field: "baseline.period", message: "종료일이 시작일보다 빠릅니다." });
    }
  }
  return e;
}

export function validateForSubmit(input: ProjectInput, c: Criteria): FieldError[] {
  const e = validateDraft(input);
  if (!input.sysNm?.trim()) e.push({ field: "sysNm", message: "시스템명을 입력해 주세요." });
  if (!input.base?.domainCd) e.push({ field: "domainCd", message: "업무 도메인을 선택해 주세요." });
  if (!input.base?.sysTypeCd) e.push({ field: "sysTypeCd", message: "시스템 유형을 선택해 주세요." });
  if (!input.base?.langCds?.length) e.push({ field: "langCds", message: "주 개발 언어를 1개 이상 선택해 주세요." });
  if (!input.base?.description?.trim()) e.push({ field: "description", message: "과제 설명을 입력해 주세요." });
  for (const a of c.areas) {
    for (const i of a.indicators) {
      if (i.tier !== "MAJOR") continue;
      if (!i.options.some((o) => o.id === input.answers?.[i.id])) {
        e.push({ field: `answer.${i.id}`, message: `Major 지표 '${i.name}'에 응답해 주세요.` });
      }
    }
  }
  return e;
}
