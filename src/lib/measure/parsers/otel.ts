// OTel 수집기 export 는 설치 방식마다 모양이 다르다. 확인된 두 형태(OTLP JSON, 평탄화 CSV)만 읽고,
// 모르는 행은 건너뛰며 경고로 남긴다. 형식이 바뀌면 이 파일만 고친다.
import { extractWbs, headerIndex, kstDate, parseCsv, type ParseResult, type ParseWarning } from "../csv";
import type { AiUse } from "../types";
import { mergeUsage } from "./aiusageCsv";

type Ctx = { prjId: string; wbsPattern: string; fileName: string };

interface Point {
  ms: number;
  metric: "token" | "cost" | "request";
  type?: string;
  model: string;
  value: number;
  user: string;
  branch: string | null;
}

const TOKEN_FIELD: Record<string, keyof Pick<AiUse, "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens">> = {
  input: "inputTokens",
  output: "outputTokens",
  cacheread: "cacheReadTokens",
  cachecreation: "cacheWriteTokens",
  cachewrite: "cacheWriteTokens",
};

function userOf(v: string | undefined): string {
  if (!v) return "unknown";
  return v.includes("@") ? v.split("@")[0] : v;
}

function toUsage(points: Point[], ctx: Ctx): AiUse[] {
  const rows: AiUse[] = points.map((p) => {
    const base: AiUse = {
      prjId: ctx.prjId,
      wbsId: extractWbs(p.branch, ctx.wbsPattern),
      workDt: kstDate(p.ms),
      userId: p.user,
      model: p.model || "unknown",
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reportedCost: null,
      srcCd: "OTEL",
    };
    if (p.metric === "request") base.requests = p.value || 1;
    else if (p.metric === "cost") base.reportedCost = p.value;
    else {
      const f = TOKEN_FIELD[(p.type ?? "").toLowerCase()];
      if (f) base[f] = p.value;
    }
    return base;
  });
  return mergeUsage(rows);
}

type Attr = { key: string; value?: { stringValue?: string; intValue?: string | number; doubleValue?: number } };

function attrs(list: Attr[] | undefined): Record<string, string> {
  const o: Record<string, string> = {};
  for (const a of list ?? []) {
    const v = a.value?.stringValue ?? a.value?.intValue ?? a.value?.doubleValue;
    if (v !== undefined) o[a.key] = String(v);
  }
  return o;
}

const branchOf = (a: Record<string, string>) => a.wbs ?? a.branch ?? a["git.branch"] ?? a["vcs.branch"] ?? null;
const userKey = (a: Record<string, string>) => userOf(a["user.email"] ?? a["user.account_uuid"] ?? a["user.id"] ?? a.user);

function fromJson(text: string, warnings: ParseWarning[]): Point[] {
  const doc = JSON.parse(text) as {
    resourceMetrics?: { resource?: { attributes?: Attr[] }; scopeMetrics?: { metrics?: { name: string; sum?: { dataPoints?: unknown[] }; gauge?: { dataPoints?: unknown[] } }[] }[] }[];
    resourceLogs?: { resource?: { attributes?: Attr[] }; scopeLogs?: { logRecords?: { timeUnixNano?: string; body?: { stringValue?: string }; attributes?: Attr[] }[] }[] }[];
  };
  const pts: Point[] = [];
  for (const rm of doc.resourceMetrics ?? []) {
    const ra = attrs(rm.resource?.attributes);
    for (const sm of rm.scopeMetrics ?? []) {
      for (const m of sm.metrics ?? []) {
        const kind = m.name === "claude_code.token.usage" ? "token" : m.name === "claude_code.cost.usage" ? "cost" : null;
        if (!kind) continue;
        for (const dp of (m.sum?.dataPoints ?? m.gauge?.dataPoints ?? []) as { attributes?: Attr[]; timeUnixNano?: string; asInt?: string | number; asDouble?: number }[]) {
          const a = { ...ra, ...attrs(dp.attributes) };
          const ms = Number(BigInt(dp.timeUnixNano ?? "0") / 1_000_000n);
          const value = Number(dp.asInt ?? dp.asDouble ?? 0);
          if (!ms || !Number.isFinite(value)) {
            warnings.push({ line: 0, message: `${m.name} 데이터포인트 형식 오류` });
            continue;
          }
          pts.push({ ms, metric: kind, type: a.type, model: a.model ?? "", value, user: userKey(a), branch: branchOf(a) });
        }
      }
    }
  }
  for (const rl of doc.resourceLogs ?? []) {
    const ra = attrs(rl.resource?.attributes);
    for (const sl of rl.scopeLogs ?? []) {
      for (const lr of sl.logRecords ?? []) {
        const a = { ...ra, ...attrs(lr.attributes) };
        const isReq = a["event.name"] === "api_request" || lr.body?.stringValue === "claude_code.api_request";
        if (!isReq) continue;
        const ms = Number(BigInt(lr.timeUnixNano ?? "0") / 1_000_000n);
        if (!ms) continue;
        pts.push({ ms, metric: "request", model: a.model ?? "", value: 1, user: userKey(a), branch: branchOf(a) });
      }
    }
  }
  return pts;
}

function fromCsv(text: string, warnings: ParseWarning[]): Point[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const h = rows[0];
  const col = {
    ts: headerIndex(h, ["timestamp", "time"]),
    metric: headerIndex(h, ["metric", "name"]),
    type: headerIndex(h, ["type"]),
    model: headerIndex(h, ["model"]),
    value: headerIndex(h, ["value"]),
    user: headerIndex(h, ["user", "user.email"]),
    branch: headerIndex(h, ["wbs", "branch"]),
  };
  if (col.ts < 0 || col.metric < 0 || col.value < 0) {
    warnings.push({ line: 1, message: "timestamp·metric·value 열이 필요합니다." });
    return [];
  }
  const pts: Point[] = [];
  rows.slice(1).forEach((r, i) => {
    const ms = Date.parse(r[col.ts] ?? "");
    const name = r[col.metric] ?? "";
    const metric = name.includes("token") ? "token" : name.includes("cost") ? "cost" : name.includes("api_request") ? "request" : null;
    const value = Number(r[col.value]);
    if (!metric) return;
    if (!Number.isFinite(ms) || !Number.isFinite(value)) {
      warnings.push({ line: i + 2, message: "시각·값 형식 오류" });
      return;
    }
    pts.push({
      ms,
      metric,
      type: col.type >= 0 ? r[col.type] : undefined,
      model: col.model >= 0 ? r[col.model] ?? "" : "",
      value,
      user: userOf(col.user >= 0 ? r[col.user] : undefined),
      branch: col.branch >= 0 ? r[col.branch] || null : null,
    });
  });
  return pts;
}

export function parseOtel(text: string, ctx: Ctx): ParseResult<AiUse> {
  const warnings: ParseWarning[] = [];
  const isJson = ctx.fileName.toLowerCase().endsWith(".json") || text.trimStart().startsWith("{");
  let points: Point[] = [];
  try {
    points = isJson ? fromJson(text, warnings) : fromCsv(text, warnings);
  } catch (e) {
    return { rows: [], warnings: [{ line: 1, message: `파일을 해석할 수 없습니다: ${e instanceof Error ? e.message : String(e)}` }] };
  }
  return { rows: toUsage(points, ctx), warnings };
}
