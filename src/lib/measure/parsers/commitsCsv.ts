import { extractWbs, headerIndex, normDate, parseCsv, toNum, type ParseResult, type ParseWarning } from "../csv";
import type { Commit } from "../types";

type Ctx = { prjId: string; wbsPattern: string };

// 스크립트 없이 `git log --date=short --numstat --pretty="@%h|%ad|%an|%s"` 원문을 그대로 올려도 받는다.
function fromGitLog(text: string, ctx: Ctx, warnings: ParseWarning[]): Commit[] {
  const out: Commit[] = [];
  let cur: Commit | null = null;
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.startsWith("@")) {
      if (cur) out.push(cur);
      const parts = line.slice(1).split("|");
      const [hash, date, author] = parts;
      const message = parts.slice(3).join("|");
      const workDt = normDate(date);
      if (!hash || !workDt) {
        warnings.push({ line: i + 1, message: "커밋 머리줄 형식 오류" });
        cur = null;
        return;
      }
      cur = { prjId: ctx.prjId, hash, workDt, author: author ?? "", message, wbsId: extractWbs(message, ctx.wbsPattern), added: 0, deleted: 0 };
      return;
    }
    const m = /^(\d+|-)\t(\d+|-)\t/.exec(line);
    if (m && cur) {
      cur.added += m[1] === "-" ? 0 : Number(m[1]);
      cur.deleted += m[2] === "-" ? 0 : Number(m[2]);
    }
  });
  if (cur) out.push(cur);
  return out;
}

export function parseCommitsCsv(text: string, ctx: Ctx): ParseResult<Commit> {
  const warnings: ParseWarning[] = [];
  if (text.trimStart().startsWith("@")) return { rows: fromGitLog(text, ctx, warnings), warnings };
  const rows = parseCsv(text);
  if (!rows.length) return { rows: [], warnings: [{ line: 1, message: "빈 파일입니다." }] };
  const h = rows[0];
  const col = {
    hash: headerIndex(h, ["hash"]),
    date: headerIndex(h, ["date"]),
    author: headerIndex(h, ["author"]),
    msg: headerIndex(h, ["message", "subject"]),
    add: headerIndex(h, ["added", "additions"]),
    del: headerIndex(h, ["deleted", "deletions"]),
  };
  if (Object.values(col).some((i) => i < 0)) {
    return { rows: [], warnings: [{ line: 1, message: "hash,date,author,message,added,deleted 열이 필요합니다." }] };
  }
  const out: Commit[] = [];
  rows.slice(1).forEach((r, i) => {
    const workDt = normDate(r[col.date]);
    const added = toNum(r[col.add]);
    const deleted = toNum(r[col.del]);
    const hash = r[col.hash]?.trim();
    if (!hash || !workDt || added === null || deleted === null) {
      warnings.push({ line: i + 2, message: !workDt ? "날짜 형식 오류" : "해시·라인 수 형식 오류" });
      return;
    }
    const message = r[col.msg] ?? "";
    out.push({ prjId: ctx.prjId, hash, workDt, author: r[col.author] ?? "", message, wbsId: extractWbs(message, ctx.wbsPattern), added, deleted });
  });
  return { rows: out, warnings };
}
