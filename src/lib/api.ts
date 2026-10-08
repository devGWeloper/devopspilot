import { NextResponse } from "next/server";
import { StoreUnavailableError } from "./store";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function fail(status: number, code: string, message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: { code, message, ...(details !== undefined ? { details } : {}) } }, { status });
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function fromResult<T>(
  r: { ok: true; value: T } | { ok: false; status: number; code: string; message: string; details?: unknown },
  status = 200,
): NextResponse {
  return r.ok ? ok(r.value, status) : fail(r.status, r.code, r.message, r.details);
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<NextResponse>) {
  return async (...args: A): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof StoreUnavailableError) return fail(503, "DB_UNAVAILABLE", e.message);
      console.error("[api]", e);
      return fail(500, "INTERNAL", "서버 오류가 발생했습니다.");
    }
  };
}
