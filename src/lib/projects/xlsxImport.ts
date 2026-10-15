import { STAGE_LABEL, STAGES, type StageCd } from "../types";

export const SHEET_NAME = "과제·요구사항";

export interface ImportRow {
  rowNo: number;
  prj: {
    prjNm: string;
    sysNm: string;
    deptCd: string;
    teamNm: string;
    pmNm: string;
    sysGrade: string;
    deployType: string;
    area: string;
    wbsYn: string;
    vcs: string;
    pms: string;
  };
  reqId: string;
  name: string;
  stage: StageCd;
  workType: string;
  difficulty: string;
  grade: string;
  baseMd: number;
  baseSrc: string;
  staff: string[];
  extra: Record<string, string>;
}

export interface ParseError {
  rowNo: number;
  message: string;
}

const STAGE_BY_LABEL = Object.fromEntries(STAGES.map((c) => [STAGE_LABEL[c], c])) as Record<string, StageCd>;

/** "개발 · 인터페이스·연계" → DV / 인터페이스·연계. 단계와 대상 사이는 양식에서 앞뒤 공백 있는 가운뎃점이다. */
export function parseWorkType(v: string): { stage: StageCd; workType: string } | null {
  const m = /^\s*(\S+)\s+·\s+(.+?)\s*$/.exec(v);
  const stage = m ? STAGE_BY_LABEL[m[1]] : undefined;
  return stage && m ? { stage, workType: m[2] } : null;
}

const PRJ_KEYS: [string, keyof ImportRow["prj"]][] = [
  ["PRJ-01", "prjNm"],
  ["PRJ-02", "sysNm"],
  ["PRJ-03", "deptCd"],
  ["PRJ-04", "teamNm"],
  ["PRJ-05", "pmNm"],
  ["PRJ-06", "sysGrade"],
  ["PRJ-07", "deployType"],
  ["PRJ-08", "area"],
  ["PRJ-09", "wbsYn"],
  ["PRJ-10", "vcs"],
  ["PRJ-11", "pms"],
];
const CORE = new Set([...PRJ_KEYS.map((k) => k[0]), "REQ-01", "REQ-02", "REQ-03", "REQ-04", "REQ-05", "REQ-06", "REQ-07"]);

/** 셀 값 → 문자열. 셀 하나씩 받는 형태로 두어 엑셀 라이브러리 없이 테스트한다. */
export function parseGrid(grid: string[][]): { rows: ImportRow[]; errors: ParseError[] } {
  const headerIdx = grid.findIndex((r) => r.some((c) => /^PRJ-01\b/.test(c.trim())));
  if (headerIdx < 0) return { rows: [], errors: [{ rowNo: 0, message: `'${SHEET_NAME}' 시트에서 항목 ID 머리글(PRJ-01 …)을 찾지 못했습니다.` }] };
  const cols = new Map<string, number>();
  grid[headerIdx].forEach((c, i) => {
    const id = /^([A-Z]{3}-\d{2})/.exec(c.trim())?.[1];
    if (id) cols.set(id, i);
  });
  const get = (r: string[], id: string) => {
    const i = cols.get(id);
    return i === undefined ? "" : (r[i] ?? "").trim();
  };

  const rows: ImportRow[] = [];
  const errors: ParseError[] = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    const rowNo = i + 1;
    const first = (r[0] ?? "").trim();
    // 머리글 아래 '필수/선택' 줄과 예시 줄은 건너뛴다.
    if (first.startsWith("예시") || r.some((c) => c.trim() === "필수")) continue;
    const reqId = get(r, "REQ-01");
    const prjNm = get(r, "PRJ-01");
    if (!reqId && !prjNm) continue;
    const fail = (message: string) => errors.push({ rowNo, message });
    if (!prjNm) fail("PRJ-01 과제명이 비어 있습니다.");
    if (!reqId) fail("REQ-01 요구사항 ID 가 비어 있습니다.");
    const wt = parseWorkType(get(r, "REQ-03"));
    if (!wt) fail(`REQ-03 대표 업무 유형 '${get(r, "REQ-03")}' 을(를) 읽지 못했습니다. (예: 개발 · UI 개발)`);
    const baseMd = Number(get(r, "REQ-06"));
    if (!get(r, "REQ-06") || !Number.isFinite(baseMd) || baseMd < 0) fail(`REQ-06 기준 공수 '${get(r, "REQ-06")}' 가 숫자가 아닙니다.`);
    if (!prjNm || !reqId || !wt || !Number.isFinite(baseMd)) continue;

    const extra: Record<string, string> = {};
    cols.forEach((_, id) => {
      const v = get(r, id);
      if (!CORE.has(id) && v) extra[id] = v;
    });
    rows.push({
      rowNo,
      prj: Object.fromEntries(PRJ_KEYS.map(([id, k]) => [k, get(r, id)])) as ImportRow["prj"],
      reqId,
      name: get(r, "REQ-02") || reqId,
      stage: wt.stage,
      workType: wt.workType,
      difficulty: get(r, "REQ-04"),
      grade: get(r, "REQ-05"),
      baseMd,
      baseSrc: get(r, "REQ-07"),
      staff: get(r, "REF-01")
        .split(/[,，、]/)
        .map((x) => x.trim())
        .filter(Boolean),
      extra,
    });
  }
  const seen = new Map<string, number>();
  for (const r of rows) {
    const prev = seen.get(r.reqId);
    if (prev) errors.push({ rowNo: r.rowNo, message: `요구사항 ID ${r.reqId} 가 ${prev}행과 중복됩니다.` });
    else seen.set(r.reqId, r.rowNo);
  }
  return { rows, errors };
}

export async function readWorkbook(buf: ArrayBuffer): Promise<string[][] | null> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet(SHEET_NAME) ?? wb.worksheets.find((w) => w.name.includes("요구사항"));
  if (!ws) return null;
  const grid: string[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, no) => {
    const cells: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell = row.getCell(c);
      // 수식 셀은 계산 결과, 숫자는 원값 그대로 — 표시 서식(소수 자리)에 기준 공수가 잘리지 않게.
      const v = cell.value;
      cells.push(typeof v === "number" ? String(v) : (cell.text ?? "").toString());
    }
    grid[no - 1] = cells;
  });
  return Array.from(grid, (r) => r ?? []);
}
