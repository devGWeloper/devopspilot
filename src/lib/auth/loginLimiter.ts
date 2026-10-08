// 단일 프로세스로 운영되므로 메모리 카운터로 충분하다. 재시작하면 초기화되는 것은 감수한다.
export const LOCK_MAX_FAILS = 5;
const WINDOW_MS = 10 * 60 * 1000;

const g = globalThis as unknown as { __pocLoginFails?: Map<string, number[]> };
const fails = (g.__pocLoginFails ??= new Map<string, number[]>());

function recent(userId: string, now: number): number[] {
  return (fails.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
}

export function checkLock(userId: string, now = Date.now()): { locked: boolean; retryAfterSec: number } {
  const r = recent(userId, now);
  if (r.length < LOCK_MAX_FAILS) return { locked: false, retryAfterSec: 0 };
  const unlockAt = r[r.length - LOCK_MAX_FAILS] + WINDOW_MS;
  return { locked: true, retryAfterSec: Math.max(1, Math.ceil((unlockAt - now) / 1000)) };
}

export function recordFailure(userId: string, now = Date.now()): void {
  fails.set(userId, [...recent(userId, now), now]);
}

export function recordSuccess(userId: string): void {
  fails.delete(userId);
}
