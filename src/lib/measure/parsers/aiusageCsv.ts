import { headerIndex, normDate, parseCsv, toNum, type ParseResult, type ParseWarning } from "../csv";
import type { AiUse } from "../types";

export function mergeUsage(rows: AiUse[]): AiUse[] {
  const m = new Map<string, AiUse>();
  for (const r of rows) {
    const k = [r.workDt, r.userId, r.wbsId ?? "", r.model, r.srcCd].join("|");
    const cur = m.get(k);
    if (!cur) {
      m.set(k, { ...r });
      continue;
    }
    cur.requests += r.requests;
    cur.inputTokens += r.inputTokens;
    cur.outputTokens += r.outputTokens;
    cur.cacheReadTokens += r.cacheReadTokens;
    cur.cacheWriteTokens += r.cacheWriteTokens;
    if (r.reportedCost !== null) cur.reportedCost = (cur.reportedCost ?? 0) + r.reportedCost;
  }
  return Array.from(m.values());
}

export function parseAiUsageCsv(text: string, ctx: { prjId: string; wbsPattern: string }): ParseResult<AiUse> {
  const rows = parseCsv(text);
  const warnings: ParseWarning[] = [];
  if (rows.length === 0) return { rows: [], warnings: [{ line: 1, message: "빈 파일입니다." }] };
  const h = rows[0];
  const col = {
    date: headerIndex(h, ["date"]),
    user: headerIndex(h, ["user"]),
    wbs: headerIndex(h, ["wbs_id", "wbs"]),
    model: headerIndex(h, ["model"]),
    req: headerIndex(h, ["requests"]),
    inp: headerIndex(h, ["input_tokens"]),
    out: headerIndex(h, ["output_tokens"]),
    cr: headerIndex(h, ["cache_read_tokens"]),
    cw: headerIndex(h, ["cache_write_tokens", "cache_creation_tokens"]),
  };
  const missing = Object.entries(col).filter(([k, i]) => i < 0 && k !== "wbs").map(([k]) => k);
  if (missing.length) return { rows: [], warnings: [{ line: 1, message: `필수 열이 없습니다: ${missing.join(", ")} — 수집 스크립트 출력 CSV 를 올려 주세요.` }] };

  const out: AiUse[] = [];
  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const workDt = normDate(r[col.date]);
    const nums = [col.req, col.inp, col.out, col.cr, col.cw].map((i) => toNum(r[i]));
    const user = r[col.user]?.trim();
    const model = r[col.model]?.trim();
    if (!workDt || !user || !model || nums.some((n) => n === null)) {
      warnings.push({ line, message: !workDt ? "날짜 형식 오류" : !user || !model ? "사용자·모델 누락" : "숫자 형식 오류" });
      return;
    }
    const [requests, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens] = nums as number[];
    const wbs = col.wbs >= 0 ? r[col.wbs]?.trim() : "";
    out.push({
      prjId: ctx.prjId,
      wbsId: wbs || null,
      workDt,
      userId: user,
      model,
      requests,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      reportedCost: null,
      srcCd: "LOCAL_LOG",
    });
  });
  return { rows: mergeUsage(out), warnings };
}
