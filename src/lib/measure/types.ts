import type { StageCd } from "../types";

/** AI 도구 외 작업 유형 — 측정 기간 중 바꾸면 이미 입력한 값의 의미가 달라지므로 코드에 고정한다. */
export type ActType = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8";
export const ACT_TYPES: { cd: ActType; label: string; desc: string }[] = [
  { cd: "A1", label: "코드 작성·수정", desc: "직접 코딩, AI 생성 코드 수정·리팩터링" },
  { cd: "A2", label: "테스트·검증", desc: "테스트 수행·결과 확인, 배포 후 검증" },
  { cd: "A3", label: "분석·검토", desc: "요구사항·산출물·코드 검토, 장애 원인 분석, 현황 조사" },
  { cd: "A4", label: "문서 작성", desc: "설계서·산출물·보고 자료 작성" },
  { cd: "A5", label: "협의·소통", desc: "회의, 현업·고객 문의 대응, 리뷰 의견 협의" },
  { cd: "A6", label: "환경·배포·운영 조치", desc: "환경 구성, 배포, 데이터 조치, 권한·설정 변경" },
  { cd: "A7", label: "AI 사용 미수집", desc: "AI 도구를 썼지만 시간이 잡히지 않은 경우 (오프라인·미설치 PC 등)" },
  { cd: "A8", label: "기타", desc: "위 유형에 없는 업무 — 메모 필수" },
];
export const ACT_LABEL = Object.fromEntries(ACT_TYPES.map((a) => [a.cd, a.label])) as Record<ActType, string>;

/** 단계·일자 수기 입력 (EFFORT) */
export interface EffortEntry {
  unit: string;
  prjId: string;
  reqId: string;
  stage: StageCd;
  userId: string;
  workDt: string;
  /** AI 수집 시간 중 실제 작업이 아니었던 시간 (자리 비움 등) */
  reduceH: number;
  add: Partial<Record<ActType, number>>;
  memo: string;
}

export type ConfState = "CONF" | "EDIT" | "EXTRA";

/** 개발자 × 요구사항 × 일자 확정 (CONF). EXTRA = 기록 없는 날을 입력하려고 줄만 만든 상태 */
export interface DayConf {
  userId: string;
  prjId: string;
  reqId: string;
  workDt: string;
  state: ConfState;
  confirmedAt: string | null;
  revCount: number;
  /** 확정 당시 단계별 투입(h). 이후 수집값이 늦게 들어와 달라지면 다시 확정해야 한다. */
  snap: Record<string, number>;
}

export type SessionSrc = "OTEL" | "LOG";

export type SessionResolution =
  | { kind: "ASSIGN"; parts: { unit: string; min: number }[]; by: string; at: string }
  | { kind: "OFF"; by: string; at: string };

/** 수집된 AI 사용 (AIUSE) — 세션 × 일자. 요구사항 매칭은 읽을 때 현재 기준정보로 다시 계산한다. */
export interface AiSession {
  src: SessionSrc;
  sessionId: string;
  userId: string;
  workDt: string;
  tool: string;
  minutes: number;
  start: string;
  end: string;
  branch: string;
  /** 브랜치·대화에서 찾은 코드 후보 (예: REQ-0047, REQ-0047-DV). 대화 원문은 저장하지 않는다. */
  hints: string[];
  resolution: SessionResolution | null;
}

export interface Settings {
  mdHours: number;
  /** 필요 개발자 등급 → M/D 단가(원) */
  gradePrice: Record<string, number>;
  /** AI 도구 → 시간당 비용(원). 없는 도구는 defaultAiRate */
  aiRate: Record<string, number>;
  defaultAiRate: number;
  /** 확정 대상 기간 시작일 */
  measureStart: string;
  workTypes: Record<StageCd, string[]>;
}

/** 이상 감지 확인 기록 — 누가 누구에게 어떻게 확인했는지 남기는 증적 */
export type NoteStatus = "OK" | "ACTION" | "MEMO";

export interface MonitorNote {
  noteId: string;
  /** 이상 키(monitor.ts) 또는 "FREE" */
  key: string;
  status: NoteStatus;
  method: string;
  contact: string;
  text: string;
  by: string;
  byNm: string;
  at: string;
}
