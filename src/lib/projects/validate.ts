import type { Criteria, Project, ProjectBase } from "../types";
import { ENTRY_FIELDS, ENTRY_STEPS, STEP, stepOfArea, type EntryField } from "./fields";

export { ENTRY_STEPS } from "./fields";

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

const NOTE_MAX = 1000;

export function fieldValue(input: ProjectInput, f: EntryField): unknown {
  if (f.key === "prjNm" || f.key === "sysNm") return input[f.key];
  return input.base?.[f.key];
}

function isFilled(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.trim() !== "";
  return v !== null && v !== undefined;
}

export function validateDraft(input: ProjectInput): FieldError[] {
  const e: FieldError[] = [];
  if (!input.prjNm?.trim()) e.push({ field: "prjNm", message: "과제명을 입력해 주세요." });
  for (const f of ENTRY_FIELDS) {
    const v = fieldValue(input, f);
    if (f.max && typeof v === "string" && v.length > f.max) e.push({ field: f.key, message: `${f.name}은(는) ${f.max}자 이내로 입력해 주세요.` });
  }
  const acc = input.base?.aiAccounts;
  if (acc !== null && acc !== undefined && (!Number.isInteger(acc) || acc < 1 || acc > 999)) {
    e.push({ field: "aiAccounts", message: "필요 계정 수는 1 이상의 정수로 입력해 주세요." });
  }
  for (const [k, v] of Object.entries(input.notes ?? {})) {
    if (typeof v === "string" && v.length > NOTE_MAX) e.push({ field: `note.${k}`, message: "메모가 너무 깁니다." });
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

// '기타'·'복합'·'혼합'은 값만으로 무엇인지 알 수 없어 양식(REF-04)대로 비고를 함께 받는다.
const REMARK_CODES = new Set(["ETC", "MIXED"]);
const REMARK_OPTIONS = new Set(["etc"]);

export function remarkRequired(input: ProjectInput): boolean {
  const b = input.base;
  if (!b) return false;
  const codes = [b.domainCd, b.sysTypeCd, b.workAreaCd, b.llmTypeCd, b.aiToolCd, ...(b.langCds ?? [])];
  return codes.some((x) => REMARK_CODES.has(x)) || Object.values(input.answers ?? {}).some((x) => REMARK_OPTIONS.has(x));
}

// WBS 실적이 없다고 답한 과제는 기간·공수를 적을 근거가 없으므로 그때만 비워 둘 수 있다.
export function baselineRequired(input: ProjectInput): boolean {
  return input.answers?.wbs !== "no";
}

interface Check {
  ok: boolean;
  error: FieldError;
}

function submitChecks(input: ProjectInput, c: Criteria): Check[] {
  const checks: Check[] = [];
  for (const f of ENTRY_FIELDS) {
    const required = f.required || (f.key === "remark" && remarkRequired(input));
    if (!required) continue;
    const verb = f.kind === "code" || f.kind === "codes" || f.kind === "level" ? "선택" : "입력";
    checks.push({ ok: isFilled(fieldValue(input, f)), error: { field: f.key, message: `${f.name}을(를) ${verb}해 주세요.` } });
  }
  const bl = input.base?.baseline;
  if (baselineRequired(input)) {
    checks.push({ ok: !!bl?.startDate && !!bl?.endDate, error: { field: "baseline.period", message: "원 프로젝트 수행 기간을 입력해 주세요." } });
    checks.push({ ok: bl?.totalMm !== null && bl?.totalMm !== undefined, error: { field: "baseline.totalMm", message: "총 투입 공수를 입력해 주세요." } });
  }
  checks.push({ ok: !!bl?.replayPhases?.length, error: { field: "baseline.replayPhases", message: "Replay 대상 단계를 1개 이상 선택해 주세요." } });
  for (const a of c.areas) {
    for (const i of a.indicators) {
      checks.push({ ok: i.options.some((o) => o.id === input.answers?.[i.id]), error: { field: `answer.${i.id}`, message: `${i.name}을(를) 선택해 주세요.` } });
    }
  }
  return checks;
}

// 적합도 판정·균형 집계·측정 기준선이 모두 이 값들에 기대므로, 제출 시점에는 빈칸 없이 받는다.
export function validateForSubmit(input: ProjectInput, c: Criteria): FieldError[] {
  return [...validateDraft(input), ...submitChecks(input, c).filter((x) => !x.ok).map((x) => x.error)];
}

export function stepOfField(field: string, c?: Criteria): number {
  if (field.startsWith("baseline")) return STEP.BASELINE;
  if (field.startsWith("answer.") || field.startsWith("note.")) {
    const id = field.slice(field.indexOf(".") + 1);
    const area = c?.areas.find((a) => a.indicators.some((i) => i.id === id));
    return area ? stepOfArea(area.id) : STEP.FIT;
  }
  return ENTRY_FIELDS.find((f) => f.key === field)?.step ?? STEP.PROJECT;
}

export function toInput(p: Project): ProjectInput {
  return { prjNm: p.prjNm, sysNm: p.sysNm, pmUserId: p.pmUserId, base: p.base, answers: p.eval.answers, notes: p.eval.notes };
}

export interface EntryProgress {
  missing: number[];
  total: number;
  required: number;
  rate: number;
  done: boolean;
}

// 기입 목록과 입력 화면이 같은 기준으로 "무엇이 남았는지"를 말하도록, 제출 검증 결과를 단계별로 묶는다.
// rate 는 양식 REF-05(필수 입력 완료율)와 같은 뜻이다.
export function entryProgress(input: ProjectInput, c: Criteria): EntryProgress {
  const checks = submitChecks(input, c);
  const missing = ENTRY_STEPS.map(() => 0);
  for (const x of checks) if (!x.ok) missing[stepOfField(x.error.field, c)] += 1;
  const total = missing.reduce((a, b) => a + b, 0);
  return { missing, total, required: checks.length, rate: checks.length ? (checks.length - total) / checks.length : 1, done: total === 0 };
}
