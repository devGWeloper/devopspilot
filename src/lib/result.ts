export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; code: string; message: string; details?: unknown };

export const okR = <T>(value: T): ServiceResult<T> => ({ ok: true, value });

export const err = (status: number, code: string, message: string, details?: unknown): { ok: false; status: number; code: string; message: string; details?: unknown } => ({
  ok: false,
  status,
  code,
  message,
  details,
});

export const forbiddenR = (message = "권한이 없습니다.") => err(403, "FORBIDDEN", message);
export const notFoundR = (what = "대상") => err(404, "NOT_FOUND", `${what}을(를) 찾을 수 없습니다.`);
export const conflictR = () => err(409, "CONFLICT", "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도해 주세요.");
