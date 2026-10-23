// 화면(클라이언트)도 쓰는 규칙 이름·설명 — 계산 코드(monitor.ts)를 번들에 싣지 않으려고 분리
export type Severity = "high" | "mid" | "low";

export interface Anomaly {
  /** 규칙|대상 — 확인 기록이 이 키에 붙으므로 같은 이상은 다시 계산해도 같은 키여야 한다 */
  key: string;
  rule: RuleCd;
  severity: Severity;
  userId: string | null;
  reqId: string | null;
  date: string | null;
  title: string;
  detail: string;
}

export type RuleCd = "SAME_HOURS" | "OVER_DAY" | "BULK_CONF" | "BIG_REDUCE" | "SPIKE" | "OVER_BASE" | "TOO_GOOD" | "NO_AI" | "LATE_CONF" | "PENDING_OLD" | "MIXED_STAGE";

export const RULES: Record<RuleCd, { label: string; why: string }> = {
  SAME_HOURS: { label: "같은 시간 반복", why: "여러 날 하루 합계가 똑같으면 실제 기록이 아니라 형식적으로 채웠을 수 있습니다." },
  OVER_DAY: { label: "하루 과다 입력", why: "하루 합계가 12시간을 넘었습니다." },
  BULK_CONF: { label: "몰아서 확정", why: "여러 날을 한꺼번에 확정했습니다. 날마다 확인하지 않았을 수 있습니다." },
  BIG_REDUCE: { label: "AI 시간 크게 줄임", why: "자동 수집된 AI 시간의 절반 넘게 줄였습니다." },
  SPIKE: { label: "평소와 다른 날", why: "본인의 평소 하루 합계보다 크게 튀었습니다." },
  OVER_BASE: { label: "기준 공수 초과", why: "투입이 기준 공수의 1.5배를 넘었습니다." },
  TOO_GOOD: { label: "절감률 과대", why: "측정 완료인데 절감률이 80% 를 넘습니다. 입력이 빠졌을 수 있습니다." },
  NO_AI: { label: "AI 사용 없음", why: "측정 완료인데 AI 사용 시간이 0 입니다. 수집 누락이거나 AI 를 쓰지 않았습니다." },
  LATE_CONF: { label: "확정 지연", why: "입력이 있는데 5일 넘게 확정하지 않았습니다." },
  PENDING_OLD: { label: "요구사항 미지정 Codex 사용 방치", why: "어느 일인지 정하지 않은 AI 사용이 3일 넘게 남아 있습니다." },
  MIXED_STAGE: { label: "한 세션에 여러 단계", why: "한 Codex 세션에서 여러 단계 일을 했습니다. 단계별 시간이 개발자 기억에 의존하게 되므로 단계마다 새 세션을 열도록 안내합니다." },
};

