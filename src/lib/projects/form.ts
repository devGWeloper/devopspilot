// 선정 현황 표·필터가 쓰는 항목 목록 — 기준정보 엑셀 '01. 과제'·'02. 요구사항-SDLC' 의 열을 옮겨 둔다.
// 항목 ID 는 선정 양식 v0.0 때 붙인 것을 이어 쓴다(화면 필터·저장된 화면 상태가 ID 로 묶여 있어서).
import { STAGE_LABEL, type Project, type Requirement, type Stage } from "../types";

export type FormGroup = "PRJ" | "REQ" | "FIT";

export const FORM_GROUPS: { key: FormGroup; title: string }[] = [
  { key: "PRJ", title: "① 과제" },
  { key: "REQ", title: "② 요구사항" },
  { key: "FIT", title: "③ AI 적합도" },
];

export interface FormField {
  id: string;
  label: string;
  group: FormGroup;
  sub: string;
  kind: "text" | "select" | "number" | "auto";
  required: boolean;
  options?: string[];
}

const f = (id: string, label: string, sub: string, kind: FormField["kind"], required: boolean, options?: string[]): FormField => ({
  id,
  label,
  group: id.slice(0, 3) as FormGroup,
  sub,
  kind,
  required,
  options,
});

const LV = ["상", "중", "하"];

export const FORM_FIELDS: FormField[] = [
  f("PRJ-01", "하이닉스 과제명", "기본 정보", "text", true),
  f("PRJ-12", "PROMIS 코드", "기본 정보", "text", false),
  f("PRJ-02", "대상 시스템명", "기본 정보", "text", true),
  f("PRJ-03", "하이닉스 담당", "담당", "select", true, ["MES", "MIS", "기타"]),
  f("PRJ-04", "하이닉스 담당 팀", "담당", "text", false),
  f("PRJ-14", "SK AX 소속 본부", "담당", "text", false),
  f("PRJ-15", "SK AX 소속 팀", "담당", "text", false),
  f("PRJ-05", "과제 PM", "담당", "text", true),
  f("PRJ-06", "시스템 등급", "시스템 특성", "select", true, ["L0", "L1", "L2", "L3", "L4", "미확인"]),
  f("PRJ-07", "배포 형식", "시스템 특성", "select", false, ["Web — On-Premise", "Web — Cloud", "C/S — 설치형", "Mobile", "서버 전용 (UI 없음)", "설비·Embedded", "복합"]),
  f("PRJ-08", "과제 영역", "시스템 특성", "select", false, ["신규 구축", "기능 개선", "전환", "재구축 (차세대)", "혼합"]),
  f("PRJ-10", "버전 관리 도구", "관리 도구", "select", false, ["Bitbucket", "GitHub", "GitLab", "Azure Repos", "SVN", "기타", "없음"]),
  f("PRJ-11", "작업 관리 도구", "관리 도구", "select", false, ["Jira", "Redmine", "Azure Boards", "사내 작업관리 시스템", "엑셀·문서", "기타", "없음"]),
  f("REQ-01", "공수 태그", "기본 정보", "auto", true),
  f("REQ-02", "요구사항 ID", "기본 정보", "text", true),
  f("REQ-03", "단계", "기본 정보", "select", true, Object.values(STAGE_LABEL)),
  f("REQ-04", "구현 난이도", "규모", "select", true, LV),
  f("REQ-05", "필요 개발자 등급", "규모", "select", true, ["특급", "고급", "중급", "초급"]),
  f("REQ-06", "기준 공수 (M/D)", "규모", "number", true),
  f("REQ-07", "공수 출처", "규모", "select", true, ["WBS 실적", "공수 산정서", "과거 실적", "담당자 추정"]),
  f("REQ-08", "담당 (사번)", "담당", "text", true),
  f("FIT-06", "예상 기대효과", "평가", "select", true, LV),
  f("FIT-01", "명세 명확성", "평가", "select", true, LV),
  f("FIT-02", "맥락 주입 가능성", "평가", "select", true, LV),
  f("FIT-03", "생성 패턴", "평가", "select", true, LV),
];

export const FIELD_BY_ID = Object.fromEntries(FORM_FIELDS.map((x) => [x.id, x])) as Record<string, FormField>;

/** 공수 태그 한 행을 항목 ID → 값으로 펼친다 */
export function formValues(p: Project, r: Requirement, s: Stage, code: string): Record<string, string> {
  return {
    "PRJ-01": p.prjNm,
    "PRJ-12": p.promisCd,
    "PRJ-02": p.sysNm,
    "PRJ-03": p.deptCd,
    "PRJ-04": p.teamNm,
    "PRJ-14": p.axHq,
    "PRJ-15": p.axTeam,
    "PRJ-05": p.pmNm,
    "PRJ-06": p.sysGrade,
    "PRJ-07": p.deployType,
    "PRJ-08": p.area,
    "PRJ-10": p.vcs,
    "PRJ-11": p.pms,
    "REQ-01": code,
    "REQ-02": r.reqId,
    "REQ-03": STAGE_LABEL[s.cd],
    "REQ-04": s.difficulty,
    "REQ-05": s.grade,
    "REQ-06": String(s.baseMd),
    "REQ-07": s.baseSrc,
    "REQ-08": s.ownerNm ? `${s.ownerNm}${s.ownerId && s.ownerId !== s.ownerNm ? ` (${s.ownerId})` : ""}` : (s.ownerId ?? ""),
    "FIT-06": s.fit,
    "FIT-01": s.spec,
    "FIT-02": s.ctx,
    "FIT-03": s.gen,
  };
}

/** 필수 항목 중 비어 있는 것 */
export function missingRequired(v: Record<string, string>): FormField[] {
  return FORM_FIELDS.filter((x) => x.required && !(v[x.id] ?? "").trim());
}

/** 선택값 순서대로 센다. 선택지 밖에서 직접 적은 값은 뒤에, 빈 값은 세지 않는다. */
export function tally(options: string[], vals: string[]): { v: string; n: number }[] {
  const extra = Array.from(new Set(vals.filter((v) => v && !options.includes(v)))).sort();
  return [...options, ...extra].map((v) => ({ v, n: vals.filter((x) => x === v).length }));
}
