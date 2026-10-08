export type Phase = "DESIGN" | "DEV" | "UNIT" | "INTEG";
export const PHASES: Phase[] = ["DESIGN", "DEV", "UNIT", "INTEG"];
export const PHASE_LABEL: Record<Phase, string> = { DESIGN: "상세설계", DEV: "개발", UNIT: "단위테스트", INTEG: "통합테스트" };

export type FeatureStatus = "WAIT" | "DOING" | "DONE";
export const FEATURE_STATUS_LABEL: Record<FeatureStatus, string> = { WAIT: "대기", DOING: "진행", DONE: "완료" };

export type AiLevel = "NONE" | "PARTIAL" | "LEAD";
export const AI_LEVEL_LABEL: Record<AiLevel, string> = { NONE: "안씀", PARTIAL: "일부", LEAD: "주도" };

export interface Baseline {
  DESIGN: number;
  DEV: number;
  UNIT: number;
  INTEG: number;
  defects: number;
  evidence: string;
  evidenceVerified: boolean;
}

export interface Feature {
  prjId: string;
  wbsId: string;
  name: string;
  typeCd: string;
  devUserId: string | null;
  devUserNm: string | null;
  status: FeatureStatus;
  completedAt: string | null;
  baseline: Baseline;
  note: string;
}

export interface Effort {
  prjId: string;
  wbsId: string;
  workDt: string;
  phase: Phase;
  hours: number;
  userId: string;
  aiLevel: AiLevel | null;
  memo: string;
  srcCd: "MANUAL" | "GRID";
}

export interface Defect {
  prjId: string;
  wbsId: string;
  defectId: string;
  foundDt: string;
  phase: Phase;
  cause: string;
  severity: "CRITICAL" | "NORMAL";
  title: string;
  testCaseRef: string;
  srcCd: "MANUAL" | "JIRA";
}

export interface AiUse {
  prjId: string;
  wbsId: string | null;
  workDt: string;
  userId: string;
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reportedCost: number | null;
  srcCd: "OTEL" | "LOCAL_LOG" | "MANUAL";
}

export interface Commit {
  prjId: string;
  hash: string;
  workDt: string;
  author: string;
  message: string;
  wbsId: string | null;
  added: number;
  deleted: number;
}

export interface TokenPrice {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface JiraMapping {
  idCol: string;
  createdCol: string;
  summaryCol: string;
  wbsCol: string | null;
  priorityCol: string | null;
  priorityMap: Record<string, "CRITICAL" | "NORMAL">;
  phaseCol: string | null;
  causeCol: string | null;
}

export interface MeasureSettings {
  laborRatePerHour: number;
  tokenPrices: TokenPrice[];
  postFixDays: number;
  phases: Record<Phase, boolean>;
  crossCheckToleranceDays: number;
  idleAlertDays: number;
  mdHours: number;
  sizeBands: { S: number; M: number; L: number };
  featureTypes: { code: string; label: string }[];
  wbsPattern: string;
  jiraMappings: Record<string, JiraMapping>;
  sampleValues: boolean;
}

export type Size = "S" | "M" | "L";

export interface MetricSet {
  featureCount: number;
  doneCount: number;
  reference: boolean;
  sumA: number;
  sumB: number;
  hoursPerFeature: number | null;
  savingRate: number | null;
  phaseSaving: Record<Phase, number | null>;
  aiCost: number;
  aiRequests: number;
  costPerFeature: number | null;
  costDiffPerFeature: number | null;
  defectRateA: number | null;
  defectRateB: number | null;
  postFixRate: number | null;
  postFixLines: number;
  totalLines: number;
}

export interface FeatureMetric {
  feature: Feature;
  a: number;
  b: number;
  aByPhase: Record<Phase, number>;
  bByPhase: Record<Phase, number>;
  savingRate: number | null;
  size: Size;
  sizeOutOfRange: boolean;
  aiCost: number;
  aiRequests: number;
  defectsB: number;
  postFixLines: number;
  totalLines: number;
  firstWorkDt: string | null;
  lastWorkDt: string | null;
}

export interface MetricsResult {
  overall: MetricSet;
  byProject: Record<string, MetricSet>;
  byType: Record<string, MetricSet>;
  byTypeSize: Record<string, MetricSet>;
  byFeature: FeatureMetric[];
  requestsByDay: { date: string; requests: number; cost: number }[];
  unpricedModels: string[];
}

export interface MeasureInput {
  features: Feature[];
  efforts: Effort[];
  defects: Defect[];
  usages: AiUse[];
  commits: Commit[];
  settings: MeasureSettings;
}
