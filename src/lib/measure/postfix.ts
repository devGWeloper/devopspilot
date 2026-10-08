// 날짜는 YYYY-MM-DD 문자열로 다룬다 — 타임존 변환 없이 사전순 비교가 곧 날짜 비교가 된다.
export function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function isPostFix(commitDt: string, completedAt: string | null, days: number): boolean {
  if (!completedAt) return false;
  return commitDt > completedAt && commitDt <= addDays(completedAt, days);
}

export function daysBetween(a: string, b: string): number {
  const toT = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toT(b) - toT(a)) / 86_400_000);
}
