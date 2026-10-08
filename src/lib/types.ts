export type Role = "AX_ADMIN" | "HX_REVIEWER" | "PM" | "DEVELOPER" | "TESTER" | "VIEWER";
export type OrgCd = "SKAX" | "SKHYNIX";
export type Level = "H" | "M" | "L";
export type Fit = Level | "NA";
export type Tier = "MAJOR" | "MINOR";
export type ProjectStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "REVIEW"
  | "SUPPLEMENT"
  | "SELECTED"
  | "RESERVE"
  | "EXCLUDED";
export type AgreeCd = "AGREE" | "DISAGREE" | "HOLD" | "NONE";

export const ROLES: Role[] = ["AX_ADMIN", "HX_REVIEWER", "PM", "DEVELOPER", "TESTER", "VIEWER"];
export const LEVELS: Level[] = ["H", "M", "L"];
export const FITS: Fit[] = ["H", "M", "L", "NA"];
export const STATUSES: ProjectStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "REVIEW",
  "SUPPLEMENT",
  "SELECTED",
  "RESERVE",
  "EXCLUDED",
];

export interface CriteriaOption {
  id: string;
  label: string;
  level: Level;
  hint?: string;
}

export interface Indicator {
  id: string;
  name: string;
  description: string;
  tier: Tier;
  options: CriteriaOption[];
}

export interface Area {
  id: string;
  name: string;
  question: string;
  indicators: Indicator[];
}

export interface FitRule {
  lowMinMajorLow: number;
  highMaxMajorLow: number;
  highMinMajorHigh: number | "half";
}

export interface Criteria {
  version: number;
  publishedAt: string | null;
  publishedBy: string | null;
  rule: FitRule;
  areas: Area[];
}

export interface CodeItem {
  code: string;
  label: string;
}

export interface BalanceTarget {
  total: number;
  byFit: Record<Level, number>;
  minPerDevType: number;
  minLangKinds: number;
}

export interface Codes {
  langs: CodeItem[];
  domains: CodeItem[];
  sysTypes: CodeItem[];
  target: BalanceTarget;
}

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

export type ReplayPhase = "ANALYSIS" | "DESIGN" | "DEV" | "TEST";
export const REPLAY_PHASES: ReplayPhase[] = ["ANALYSIS", "DESIGN", "DEV", "TEST"];

export interface ProjectBaseline {
  startDate: string | null;
  endDate: string | null;
  totalMm: number | null;
  phaseMm: Record<ReplayPhase, number | null>;
  screens: number | null;
  programs: number | null;
  loc: number | null;
  replayPhases: ReplayPhase[];
}

export interface ProjectBase {
  description: string;
  domainCd: string;
  sysTypeCd: string;
  langCds: string[];
  techStack: string;
  orgNm: string;
  baseline: ProjectBaseline;
}

export interface FitConfirm {
  fit: Level;
  reason: string;
  by: string;
  byNm: string;
  at: string;
}

export interface EvalData {
  answers: Record<string, string>;
  notes: Record<string, string>;
  confirm: FitConfirm | null;
}

export interface ReviewEntry {
  id: string;
  side: "AX" | "HX";
  userId: string;
  userNm: string;
  agree: AgreeCd;
  text: string;
  at: string;
  context: "SELECTION" | "MEASURE";
}

export interface AiResult {
  grade: Level;
  summary: string;
  strengths: string[];
  risks: string[];
  indicatorComments: { indicatorId: string; comment: string }[];
  replayNotes: string;
  balanceNote: string;
  model: string;
  promptVersion: number;
  criteriaVersion: number;
  assessedAt: string;
  assessedBy: string;
}

export interface Project {
  prjId: string;
  prjNm: string;
  sysNm: string;
  pmUserId: string;
  pmUserNm: string;
  status: ProjectStatus;
  statusNote: string | null;
  devTypeCd: string | null;
  mainLangCd: string | null;
  domainCd: string | null;
  sysTypeCd: string | null;
  answerCnt: number;
  indicatorCnt: number;
  suggestFit: Fit;
  finalFit: Fit;
  aiFit: Fit | null;
  axAgree: AgreeCd;
  hxAgree: AgreeCd;
  critVer: number;
  base: ProjectBase;
  eval: EvalData;
  reviews: ReviewEntry[];
  ai: AiResult | null;
  regUserId: string;
  regAt: string;
  updUserId: string;
  updAt: string;
}

export type HistoryTarget = "PROJECT" | "CRITERIA" | "USER" | "CODES" | "AI_PROMPT" | "UPLOAD" | "MEASURE";

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

export const DEV_TYPE_INDICATOR = "devType";
export const EXEC_TYPE_INDICATOR = "execType";
