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

/** 이 간격보다 오래 기록이 없으면 자리를 비운 것으로 보고 시간에 넣지 않는다 */
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

/** 로컬 로그 업로드 — 브라우저가 Codex 세션 파일에서 뽑은 요약(parseCodexSessions 결과) */
export function parseLogUpload(raw: unknown): ParsedUpload | { error: string } {
  const r = raw as { format?: string; sessions?: unknown[] } | null;
  if (!r || r.format !== "poc-ai-sessions" || !Array.isArray(r.sessions))
    return { error: "Codex 세션 요약 형식이 아닙니다. 화면을 새로 고친 뒤 다시 올려 주세요." };
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

// ---- Codex 세션 파일(~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl) ----

export interface SessionFile {
  name: string;
  text: string;
}

/** 서버로 보내는 요약 — parseLogUpload 가 읽는 형식 */
export interface SessionSummary {
  format: "poc-ai-sessions";
  version: 3;
  sessions: { tool: string; sessionId: string; date: string; start: string; end: string; activeMin: number; branch: string; hints: string[]; tokens?: Record<string, TokenUse> }[];
}

interface Acc {
  times: Set<number>;
  branch: string;
  hints: string[];
  /** 일자 → 모델 → 토큰 */
  tokens: Map<string, Record<string, TokenUse>>;
  /** 이어하기로 같은 세션이 여러 파일에 복사돼도 토큰을 두 번 세지 않게 */
  seenTok: Set<string>;
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .filter((c) => c && typeof c === "object" && ["text", "input_text"].includes((c as { type?: string }).type ?? ""))
      .map((c) => String((c as { text?: unknown }).text ?? ""))
      .join(" ");
  return "";
}

const usageOf = (u: unknown): TokenUse => {
  const o = (u && typeof u === "object" ? u : {}) as Record<string, unknown>;
  return { input: num(o.input_tokens), cached: num(o.cached_input_tokens), output: num(o.output_tokens) };
};

/**
 * Codex 세션 파일 → 세션 × 일자(KST) 요약. 브라우저에서 돌려 대화 원문은 PC 밖으로 나가지 않는다.
 * 활동 시간은 기록 사이 간격(5분까지)의 합, 토큰은 token_count 누적값의 증가분을 그때 모델에 더한다.
 */
export function parseCodexSessions(files: SessionFile[], since = ""): { summary: SessionSummary; warnings: string[] } {
  const warnings: string[] = [];
  const bySid = new Map<string, Acc>();
  for (const f of files) {
    const base = f.name.split(/[\/]/).pop() ?? f.name;
    let sid = base.replace(/\.jsonl$/i, "");
    const times: number[] = [];
    const texts: string[] = [];
    const toks: { key: string; day: string; model: string; use: TokenUse }[] = [];
    let branch = "";
    let model = "";
    let prev: TokenUse = { input: 0, cached: 0, output: 0 };
    let bad = 0;
    let lines = 0;
    for (const line of f.text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      lines++;
      let d: Record<string, unknown>;
      try {
        d = JSON.parse(line);
      } catch {
        bad++;
        continue;
      }
      if (!d || typeof d !== "object") continue;
      const p = (d.payload && typeof d.payload === "object" ? d.payload : {}) as Record<string, unknown>;
      const ms = Date.parse(String(d.timestamp ?? ""));
      if (Number.isFinite(ms)) times.push(ms);
      if (d.type === "session_meta") {
        sid = String(p.id || sid);
        branch = String((p.git as { branch?: string } | undefined)?.branch || branch);
      } else if (d.type === "turn_context") model = String(p.model || model);
      else if (p.type === "message" && p.role === "user") texts.push(textOf(p.content));
      else if (p.type === "user_message") texts.push(String(p.message ?? ""));
      else if (p.type === "token_count" && p.info && typeof p.info === "object") {
        const total = usageOf((p.info as Record<string, unknown>).total_token_usage);
        const use = { input: Math.max(0, total.input - prev.input), cached: Math.max(0, total.cached - prev.cached), output: Math.max(0, total.output - prev.output) };
        if (Number.isFinite(ms) && use.input + use.cached + use.output > 0)
          toks.push({ key: `${d.timestamp}|${total.input}|${total.output}`, day: kstDate(ms), model: model || "unknown", use });
        prev = { input: Math.max(prev.input, total.input), cached: Math.max(prev.cached, total.cached), output: Math.max(prev.output, total.output) };
      }
    }
    if (lines === 0 || bad === lines || times.length === 0) {
      warnings.push(`${base}: Codex 세션 기록이 아닙니다 — 건너뜀`);
      continue;
    }
    if (bad) warnings.push(`${base}: ${bad}줄 해석 실패 — 건너뜀`);
    const a = bySid.get(sid) ?? { times: new Set<number>(), branch: "", hints: [], tokens: new Map(), seenTok: new Set<string>() };
    times.forEach((t) => a.times.add(t));
    a.branch ||= branch;
    a.hints = Array.from(new Set([...a.hints, ...extractHints(branch), ...texts.flatMap(extractHints)])).slice(0, 20);
    for (const t of toks) {
      if (a.seenTok.has(t.key)) continue;
      a.seenTok.add(t.key);
      a.tokens.set(t.day, addTokens(a.tokens.get(t.day), t.model, t.use));
    }
    bySid.set(sid, a);
  }
  const sessions: SessionSummary["sessions"] = [];
  for (const [sid, a] of Array.from(bySid)) {
    const byDay = new Map<string, number[]>();
    for (const t of Array.from(a.times).sort((x, y) => x - y)) {
      const k = kstDate(t);
      const list = byDay.get(k) ?? [];
      list.push(t);
      byDay.set(k, list);
    }
    for (const [date, ts] of Array.from(byDay)) {
      if (since && date < since) continue;
      const activeMin = Math.round(activeMinutes(ts));
      if (activeMin <= 0) continue;
      const tokens = a.tokens.get(date);
      sessions.push({ tool: "Codex", sessionId: sid, date, start: kstTime(ts[0]), end: kstTime(ts[ts.length - 1]), activeMin, branch: a.branch, hints: a.hints, ...(tokens ? { tokens } : {}) });
    }
  }
  sessions.sort((x, y) => x.date.localeCompare(y.date) || x.start.localeCompare(y.start));
  return { summary: { format: "poc-ai-sessions", version: 3, sessions }, warnings };
}
