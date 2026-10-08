// 클라이언트의 유일한 /api 호출 경로. 원시 fetch 를 쓰면 세션 만료(401)가 데이터로 둔갑해 화면이 깨진다.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();
let expired = false;

export function onSessionExpired(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function resetSessionExpired(): void {
  expired = false;
}

function markExpired() {
  if (expired) return;
  expired = true;
  listeners.forEach((l) => l());
}

async function errorOf(res: Response): Promise<ApiError> {
  let code = "HTTP_" + res.status;
  let message = `요청에 실패했습니다 (HTTP ${res.status})`;
  let details: unknown;
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } };
    if (body.error?.code) code = body.error.code;
    if (body.error?.message) message = body.error.message;
    details = body.error?.details;
  } catch {
    // 본문이 JSON 이 아니면 상태 코드 기반 문구를 쓴다.
  }
  return new ApiError(message, res.status, code, details);
}

export async function api<T>(url: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body !== undefined || init.form ? "POST" : "GET"),
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    cache: "no-store",
  });
  if (res.status === 401 && !url.includes("/api/auth/login")) markExpired();
  if (!res.ok) throw await errorOf(res);
  const body = (await res.json()) as { data: T };
  return body.data;
}

export async function download(url: string, fallbackName: string): Promise<void> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) markExpired();
  if (!res.ok) throw await errorOf(res);
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function errMessage(e: unknown, fallback = "요청에 실패했습니다."): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
