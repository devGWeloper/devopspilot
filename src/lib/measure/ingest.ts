import { extractHints } from "./match";
import type { AiSession } from "./types";

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
      tool: String(s.tool ?? "unknown"),
      minutes: Math.round(min),
      start: String(s.start ?? ""),
      end: String(s.end ?? ""),
      branch: String(s.branch ?? ""),
      hints: Array.isArray(s.hints) ? s.hints.map(String).slice(0, 20) : extractHints(String(s.branch ?? "")),
    });
  });
  return { sessions, warnings };
}

// ---- OTLP/HTTP JSON ----
type AnyValue = { stringValue?: string; intValue?: string | number; doubleValue?: number; boolValue?: boolean };
type KV = { key: string; value?: AnyValue };

const attrs = (list: KV[] | undefined): Record<string, string> =>
  Object.fromEntries((list ?? []).map((kv) => [kv.key, String(kv.value?.stringValue ?? kv.value?.intValue ?? kv.value?.doubleValue ?? kv.value?.boolValue ?? "")]));

const toolOf = (service: string) =>
  /claude/i.test(service) ? "Claude Code" : /codex/i.test(service) ? "Codex" : service || "unknown";

/** 포털 계정 ID — 개발자 PC 설정에서 OTEL_RESOURCE_ATTRIBUTES=poc.user=<ID> 로 넣는다. 없으면 이메일 앞부분 */
const userOf = (a: Record<string, string>) => a["poc.user"] || (a["user.email"] ?? "").split("@")[0] || "";

export interface OtelDelta {
  userId: string;
  sessionId: string;
  tool: string;
  workDt: string;
  ms: number;
  minutes: number;
  hints: string[];
  branch: string;
}

const ms = (nano: string | number | undefined) => Math.floor(Number(nano ?? 0) / 1e6) || Date.now();

/**
 * Claude Code 메트릭 `claude_code.active_time.total`(초, delta) → 세션별 분.
 * 누적(cumulative)으로 보내면 중복 합산되므로 PC 설정에서 delta 를 강제한다(설치 안내 참고).
 */
export function parseOtelMetrics(body: unknown): OtelDelta[] {
  const out: OtelDelta[] = [];
  const rms = (body as { resourceMetrics?: unknown[] })?.resourceMetrics ?? [];
  for (const rm of rms as { resource?: { attributes?: KV[] }; scopeMetrics?: { metrics?: unknown[] }[] }[]) {
    const ra = attrs(rm.resource?.attributes);
    for (const sm of rm.scopeMetrics ?? []) {
      for (const m of (sm.metrics ?? []) as { name?: string; sum?: { dataPoints?: unknown[] }; gauge?: { dataPoints?: unknown[] } }[]) {
        if (!m.name || !/active_time/.test(m.name)) continue;
        for (const dp of ((m.sum ?? m.gauge)?.dataPoints ?? []) as { attributes?: KV[]; asDouble?: number; asInt?: string | number; timeUnixNano?: string }[]) {
          const a = { ...ra, ...attrs(dp.attributes) };
          const sec = Number(dp.asDouble ?? dp.asInt ?? 0);
          const userId = userOf(a);
          if (!userId || !(sec > 0)) continue;
          const t = ms(dp.timeUnixNano);
          out.push({
            userId,
            sessionId: a["session.id"] || a["conversation.id"] || `${userId}-${kstDate(t)}`,
            tool: toolOf(a["service.name"] ?? ""),
            workDt: kstDate(t),
            ms: t,
            minutes: sec / 60,
            hints: extractHints(a["poc.branch"] ?? ""),
            branch: a["poc.branch"] ?? "",
          });
        }
      }
    }
  }
  return out;
}

/** 프롬프트 이벤트에서 요구사항 코드만 뽑는다(OTEL_LOG_USER_PROMPTS=1 일 때). 프롬프트 원문은 버린다. */
export function parseOtelLogs(body: unknown): OtelDelta[] {
  const out: OtelDelta[] = [];
  const rls = (body as { resourceLogs?: unknown[] })?.resourceLogs ?? [];
  for (const rl of rls as { resource?: { attributes?: KV[] }; scopeLogs?: { logRecords?: unknown[] }[] }[]) {
    const ra = attrs(rl.resource?.attributes);
    for (const sl of rl.scopeLogs ?? []) {
      for (const lr of (sl.logRecords ?? []) as { attributes?: KV[]; body?: AnyValue; timeUnixNano?: string }[]) {
        const a = { ...ra, ...attrs(lr.attributes) };
        const name = a["event.name"] || lr.body?.stringValue || "";
        if (!/user_prompt/.test(name)) continue;
        const hints = extractHints(`${a.prompt ?? ""} ${a["poc.branch"] ?? ""}`);
        const userId = userOf(a);
        if (!userId || hints.length === 0) continue;
        const t = ms(lr.timeUnixNano);
        out.push({
          userId,
          sessionId: a["session.id"] || a["conversation.id"] || `${userId}-${kstDate(t)}`,
          tool: toolOf(a["service.name"] ?? ""),
          workDt: kstDate(t),
          ms: t,
          minutes: 0,
          hints,
          branch: a["poc.branch"] ?? "",
        });
      }
    }
  }
  return out;
}
