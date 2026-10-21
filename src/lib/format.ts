// 화면 표시 전용 반올림. 계산은 metrics.ts 의 원값을 그대로 쓴다.
export function pct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits).replace(/^-0(\.0+)?$/, "0")}%`;
}

export function hours(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const r = Math.round(v * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}h`;
}

export function won(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1_000_000) return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만원`;
  if (Math.abs(v) >= 10_000 && Number.isInteger(v / 10_000)) return `${(v / 10_000).toLocaleString("ko-KR")}만원`;
  return `${Math.round(v).toLocaleString("ko-KR")}원`;
}

export function num(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString("ko-KR");
}

/** 소수 첫째 자리 (M/D·시간 표시용) */
export function f1(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return (Math.round(v * 10) / 10).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** 만 원 단위 정수 */
export function man(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return Math.round(v / 10_000).toLocaleString("ko-KR");
}

/** 시간(h) → "1시간 10분" — 공수 입력이 분 단위라 입력 화면은 시·분으로 보여 준다 */
export function hm(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const m = Math.round(v * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (!h) return `${mm}분`;
  return mm ? `${h}시간 ${mm}분` : `${h}시간`;
}
