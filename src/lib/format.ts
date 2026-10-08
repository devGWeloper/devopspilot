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
