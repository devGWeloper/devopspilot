import { extractWbs, normDate, parseCsv, type ParseResult, type ParseWarning } from "../csv";
import { PHASES, type Defect, type JiraMapping, type Phase } from "../types";

const PHASE_ALIAS: Record<string, Phase> = {
  상세설계: "DESIGN",
  설계: "DESIGN",
  개발: "DEV",
  단위테스트: "UNIT",
  단위: "UNIT",
  통합테스트: "INTEG",
  통합: "INTEG",
};

export function jiraHeaders(text: string): string[] {
  return (parseCsv(text)[0] ?? []).map((h) => h.trim());
}

export function parseJiraCsv(text: string, ctx: { prjId: string; wbsPattern: string; mapping: JiraMapping }): ParseResult<Defect> {
  const rows = parseCsv(text);
  const warnings: ParseWarning[] = [];
  if (!rows.length) return { rows: [], warnings: [{ line: 1, message: "빈 파일입니다." }] };
  const h = rows[0].map((x) => x.trim());
  const at = (name: string | null) => (name ? h.indexOf(name) : -1);
  const m = ctx.mapping;
  const col = { id: at(m.idCol), created: at(m.createdCol), summary: at(m.summaryCol), wbs: at(m.wbsCol), prio: at(m.priorityCol), phase: at(m.phaseCol), cause: at(m.causeCol) };
  if (col.id < 0 || col.created < 0 || col.summary < 0) {
    return { rows: [], warnings: [{ line: 1, message: "결함 ID·생성일·요약 열 매핑을 확인해 주세요." }] };
  }
  const out: Defect[] = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const defectId = r[col.id]?.trim();
    const foundDt = normDate(r[col.created]);
    const summary = r[col.summary] ?? "";
    const wbsId = extractWbs(col.wbs >= 0 ? r[col.wbs] : "", ctx.wbsPattern) ?? extractWbs(summary, ctx.wbsPattern);
    if (!defectId || !foundDt) {
      warnings.push({ line, message: "결함 ID·생성일 형식 오류" });
      return;
    }
    if (!wbsId) {
      warnings.push({ line, message: `${defectId}: WBS-ID 를 찾을 수 없어 건너뜀` });
      return;
    }
    const prio = col.prio >= 0 ? r[col.prio]?.trim() ?? "" : "";
    const phaseRaw = col.phase >= 0 ? (r[col.phase] ?? "").replace(/\s/g, "") : "";
    const phase = (PHASES as string[]).includes(phaseRaw.toUpperCase()) ? (phaseRaw.toUpperCase() as Phase) : PHASE_ALIAS[phaseRaw] ?? "UNIT";
    out.push({
      prjId: ctx.prjId,
      wbsId,
      defectId,
      foundDt,
      phase,
      cause: col.cause >= 0 ? r[col.cause] ?? "" : "",
      severity: m.priorityMap[prio] ?? "NORMAL",
      title: summary,
      testCaseRef: "",
      srcCd: "JIRA",
    });
  });
  return { rows: out, warnings };
}
