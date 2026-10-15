export type Role = "ADMIN" | "DEVELOPER" | "VIEWER";
export type OrgCd = "SKAX" | "SKHYNIX";

export const ROLES: Role[] = ["ADMIN", "DEVELOPER", "VIEWER"];

export interface UserRecord {
  userId: string;
  userNm: string;
  orgCd: OrgCd;
  deptNm: string;
  role: Role;
  useYn: boolean;
  pwdHash: string;
  pwdSalt: string;
  lastLoginAt: string | null;
  regAt: string;
  updAt: string;
}

export type PublicUser = Omit<UserRecord, "pwdHash" | "pwdSalt">;

/** SDLC 단계 — 측정 단위는 요구사항 × 단계 */
export type StageCd = "AN" | "DS" | "DV" | "TS" | "DP" | "OP";
export const STAGES: StageCd[] = ["AN", "DS", "DV", "TS", "DP", "OP"];
export const STAGE_LABEL: Record<StageCd, string> = {
  AN: "분석",
  DS: "설계",
  DV: "개발",
  TS: "테스트",
  DP: "배포",
  OP: "운영",
};

export type PrjKind = "개발" | "운영";
export const PRJ_KINDS: PrjKind[] = ["개발", "운영"];

export interface Stage {
  cd: StageCd;
  workType: string;
  ownerId: string | null;
  // 엑셀에 적힌 이름이 계정과 맞지 않아도 화면에 보여 줘야 해서 이름을 따로 둔다.
  ownerNm: string;
  baseMd: number;
}

export interface Requirement {
  reqId: string;
  name: string;
  difficulty: string;
  grade: string;
  baseSrc: string;
  stages: Stage[];
  done: boolean;
  doneAt: string | null;
  /** 양식의 나머지 항목(AIS·FIT·REF) — 항목 ID → 값. 조회용 */
  extra: Record<string, string>;
}

export interface Project {
  prjId: string;
  prjNm: string;
  sysNm: string;
  kind: PrjKind;
  deptCd: string;
  teamNm: string;
  axTeam: string;
  pmNm: string;
  sysGrade: string;
  deployType: string;
  area: string;
  wbsYn: string;
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
