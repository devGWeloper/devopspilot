export type Role = "ADMIN" | "DEVELOPER" | "VIEWER";
export type OrgCd = "SKAX" | "SKHYNIX";

export const ROLES: Role[] = ["ADMIN", "DEVELOPER", "VIEWER"];

export interface UserRecord {
  userId: string;
  userNm: string;
  orgCd: OrgCd;
  /** SK AX 본부 · 팀 */
  hqNm: string;
  deptNm: string;
  role: Role;
  /** AI 도구 계정 — 기준정보 엑셀 03 시트의 참고 값. Codex 기록은 올린 사람 계정으로 저장되므로 매칭에 쓰지 않는다 */
  aiAcct: string;
  useYn: boolean;
  pwdHash: string;
  pwdSalt: string;
  lastLoginAt: string | null;
  regAt: string;
  updAt: string;
}

export type PublicUser = Omit<UserRecord, "pwdHash" | "pwdSalt">;

/** SDLC 단계 — 측정 단위는 요구사항 × 단계 */
export type StageCd = "AN" | "DS" | "DV" | "TS";
export const STAGES: StageCd[] = ["AN", "DS", "DV", "TS"];
export const STAGE_LABEL: Record<StageCd, string> = {
  AN: "분석",
  DS: "설계",
  DV: "개발",
  TS: "테스트",
};

/** 공수 태그 = 과제 × 요구사항 × 단계. 기준정보 엑셀 '02. 요구사항-SDLC' 한 행 */
export interface Stage {
  cd: StageCd;
  workType: string;
  ownerId: string | null;
  // 엑셀에 적힌 사번이 계정과 맞지 않아도 화면에 보여 줘야 해서 이름을 따로 둔다.
  ownerNm: string;
  baseMd: number;
  difficulty: string;
  /** 필요 개발자 등급 — 인건비 단가 기준 */
  grade: string;
  baseSrc: string;
  done: boolean;
  doneAt: string | null;
  /** 예상 기대효과 · 명세 명확성 · 맥락 주입 가능성 · 생성 패턴 (상/중/하) */
  fit: string;
  spec: string;
  ctx: string;
  gen: string;
}

/** 같은 과제·요구사항 ID 의 태그 묶음. 요구사항 ID 는 과제 안에서만 유일하다. */
export interface Requirement {
  reqId: string;
  name: string;
  stages: Stage[];
}

export interface Project {
  /** 기준정보 엑셀의 과제 ID (예: DAE01) — 공수 태그 앞자리 */
  prjId: string;
  prjNm: string;
  promisCd: string;
  sysNm: string;
  /** 하이닉스 담당 · 담당 팀 */
  deptCd: string;
  teamNm: string;
  axHq: string;
  axTeam: string;
  pmNm: string;
  sysGrade: string;
  deployType: string;
  area: string;
  vcs: string;
  pms: string;
  reqs: Requirement[];
  regUserId: string;
  regAt: string;
  updUserId: string;
  updAt: string;
}

export type HistoryTarget = "PROJECT" | "USER" | "SETTINGS" | "UPLOAD" | "EFFORT";

export interface HistoryEntry {
  histId: number;
  targetTyp: HistoryTarget;
  targetId: string;
  actionCd: string;
  summary: string;
  diff: unknown;
  userId: string;
  userNm: string;
  regAt: string;
}
