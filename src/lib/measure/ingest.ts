import { extractHints } from "./match";
import type { AiSession, TokenUse } from "./types";

export const KST_OFFSET_MS = 9 * 3600 * 1000;

/** 일자 경계는 KST 로 고정 — 개발자 PC·서버 시간대가 달라도 같은 날로 묶이게. */
export function kstDate(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}
export function kstTime(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(11, 16);
}

export interface ParsedUpload {
  sessions: Omit<AiSession, "userId" | "resolution">[];
  warnings: string[];
}

/** 이 간격보다 오래 이벤트가 없으면 자리를 비운 것으로 보고 시간에 넣지 않는다 — collect_ai_usage.py 와 같은 값 */
export const IDLE_GAP_MS = 5 * 60 * 1000;

/** 정렬된 이벤트 시각(ms) → 활동 분. 앞 묶음의 마지막 시각(prev)이 있으면 그 간격부터 센다. */
export function activeMinutes(times: number[], prev?: number): number {
  const ts = [...times].sort((a, b) => a - b);
  let last = prev;
  let ms = 0;
  for (const t of ts) {
    if (last !== undefined && t > last) ms += Math.min(t - last, IDLE_GAP_MS);
    last = last === undefined ? t : Math.max(last, t);
  }
  return ms / 60000;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

function parseTokens(v: unknown): Record<string, TokenUse> | undefined {
  if (!v || typeof v !== "object") return undefined;
  const out: Record<string, TokenUse> = {};
  for (const [model, t] of Object.entries(v as Record<string, Record<string, unknown>>)) {
    if (!t || typeof t !== "object") continue;
    const u = { input: num(t.input), cached: num(t.cached), output: num(t.output) };
    if (u.input + u.output > 0) out[model] = u;
  }
  return Object.keys(out).length ? out : undefined;
}

export function addTokens(a: Record<string, TokenUse> | undefined, model: string, t: TokenUse): Record<string, TokenUse> {
  const o = { ...(a ?? {}) };
  const cur = o[model] ?? { input: 0, cached: 0, output: 0 };
  o[model] = { input: cur.input + t.input, cached: cur.cached + t.cached, output: cur.output + t.output };
  return o;
}

/** 로컬 로그 업로드 — scripts/collect_ai_usage.py 가 만든 JSON */
export function parseLogUpload(raw: unknown): ParsedUpload | { error: string } {
  const r = raw as { format?: string; sessions?: unknown[] } | null;
  if (!r || r.format !== "poc-ai-sessions" || !Array.isArray(r.sessions))
    return { error: "collect_ai_usage.py 로 만든 JSON 파일이 아닙니다. 최신 스크립트를 내려받아 다시 만들어 주세요." };
  const sessions: ParsedUpload["sessions"] = [];
  const warnings: string[] = [];
  r.sessions.forEach((x, i) => {
    const s = x as Record<string, unknown>;
    const date = String(s.date ?? "");
    const min = Number(s.activeMin);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(min) || !s.sessionId) {
      warnings.push(`${i + 1}번째 세션 형식 오류 — 건너뜀`);
      return;
    }
    if (min <= 0) return;
    sessions.push({
      src: "LOG",
      sessionId: String(s.sessionId),
      workDt: date,
      tool: String(s.tool ?? "Codex"),
      minutes: Math.round(min),
      start: String(s.start ?? ""),
      end: String(s.end ?? ""),
      branch: String(s.branch ?? ""),
      hints: Array.isArray(s.hints) ? s.hints.map(String).slice(0, 20) : extractHints(String(s.branch ?? "")),
      tokens: parseTokens(s.tokens),
    });
  });
  return { sessions, warnings };
}

// ---- OTLP/HTTP JSON (Codex [otel] 로그 이벤트) ----
type AnyValue = { stringValue?: string; intValue?: string | number; doubleValue?: number; boolValue?: boolean };
type KV = { key: string; value?: AnyValue };

const attrs = (list: KV[] | undefined): Record<string, string> =>
  Object.fromEntries((list ?? []).map((kv) => [kv.key, String(kv.value?.stringValue ?? kv.value?.intValue ?? kv.value?.doubleValue ?? kv.value?.boolValue ?? "")]));

/** Codex 이벤트 한 건. 사용자는 포털 계정의 'AI 도구 계정'과 맞춰 서버에서 정한다. */
export interface OtelEvent {
  /** user.email · user.account_id · poc.user — 계정 매핑 후보 */
  accounts: string[];
  sessionId: string;
  tool: string;
  workDt: string;
  ms: number;
  hints: string[];
  model: string;
  tokens: TokenUse | null;
}

const msOf = (rec: { timeUnixNano?: string; observedTimeUnixNano?: string }, a: Record<string, string>) =>
  Math.floor(Number(rec.timeUnixNano || rec.observedTimeUnixNano || 0) / 1e6) || Date.parse(a["event.timestamp"] ?? "") || Date.now();

/**
 * Codex 는 활동 시간 메트릭이 없어 모든 codex.* 이벤트 시각을 모아 활동 시간을 만든다(5분 넘는 공백 제외).
 * 토큰은 codex.sse_event(response.completed), 태그 후보는 codex.user_prompt 의 프롬프트(log_user_prompt = true)에서만 뽑고 원문은 버린다.
 */
export function parseOtelLogs(body: unknown): OtelEvent[] {
  const out: OtelEvent[] = [];
  const rls = (body as { resourceLogs?: unknown[] })?.resourceLogs ?? [];
  for (const rl of rls as { resource?: { attributes?: KV[] }; scopeLogs?: { logRecords?: unknown[] }[] }[]) {
    const ra = attrs(rl.resource?.attributes);
    for (const sl of rl.scopeLogs ?? []) {
      for (const lr of (sl.logRecords ?? []) as { attributes?: KV[]; body?: AnyValue; timeUnixNano?: string; observedTimeUnixNano?: string }[]) {
        const a = { ...ra, ...attrs(lr.attributes) };
        const name = a["event.name"] || lr.body?.stringValue || "";
        if (!name.startsWith("codex.")) continue;
        const accounts = [a["user.email"], a["user.account_id"], a["poc.user"]].filter((x): x is string => !!x);
        const sessionId = a["conversation.id"] || "";
        if (!accounts.length || !sessionId) continue;
        const t = msOf(lr, a);
        const done = name === "codex.sse_event" && a["event.kind"] === "response.completed" && a["input_token_count"] !== undefined;
        out.push({
          accounts,
          sessionId,
          tool: "Codex",
          workDt: kstDate(t),
          ms: t,
          hints: name === "codex.user_prompt" ? extractHints(a.prompt ?? "") : [],
          model: a.model || a.slug || "",
          tokens: done ? { input: num(a["input_token_count"]), cached: num(a["cached_token_count"]), output: num(a["output_token_count"]) } : null,
        });
      }
    }
  }
  return out;
}
