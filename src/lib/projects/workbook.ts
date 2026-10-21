// 기준정보 엑셀 '생산성 측정 PoC 데이터' 5개 시트 ↔ 포털. 셀 값은 문자열 격자로 받아 엑셀 라이브러리 없이 테스트한다.
import { STAGE_LABEL, STAGES, type Project, type Role, type StageCd, type UserRecord } from "../types";
import type { MetricDef } from "../measure/metrics";
import type { Settings } from "../measure/types";
import { unitCode } from "../measure/units";

export const SHEETS = {
  prj: "01. 과제",
  tag: "02. 요구사항-SDLC",
  map: "03. 공수 태그 매핑",
  base: "04. 기준정보",
  logic: "05. 주요 집계 로직",
} as const;
export type SheetKey = keyof typeof SHEETS;

type Col<K extends string> = [header: string, key: K];

export const PRJ_COLS: Col<"prjId" | "prjNm" | "promisCd" | "sysNm" | "deptCd" | "teamNm" | "axHq" | "axTeam" | "pmNm" | "sysGrade" | "deployType" | "area" | "vcs" | "pms">[] = [
  ["과제 ID", "prjId"],
  ["하이닉스 과제명", "prjNm"],
  ["PROMIS 코드", "promisCd"],
  ["대상 시스템명", "sysNm"],
  ["하이닉스 담당", "deptCd"],
  ["하이닉스 담당 팀", "teamNm"],
  ["SK AX 소속 본부", "axHq"],
  ["SK AX 소속 팀", "axTeam"],
  ["과제 PM", "pmNm"],
  ["시스템 등급", "sysGrade"],
  ["배포 형식", "deployType"],
  ["과제 영역", "area"],
  ["버전 관리 도구", "vcs"],
  ["작업 관리 도구", "pms"],
];

// 요구사항명·업무 유형은 원본 시트에 없지만 화면 편집 값을 잃지 않게 내보내기 끝에 붙인다(없어도 읽힌다).
export const TAG_COLS: Col<"tag" | "prjId" | "reqId" | "stage" | "difficulty" | "grade" | "baseMd" | "baseSrc" | "status" | "doneAt" | "fit" | "spec" | "ctx" | "gen" | "name" | "workType">[] = [
  ["공수 태그", "tag"],
  ["과제 ID", "prjId"],
  ["요구사항 ID", "reqId"],
  ["단계", "stage"],
  ["구현 난이도", "difficulty"],
  ["필요 개발자 등급", "grade"],
  ["기준 공수(M/D)", "baseMd"],
  ["공수 출처", "baseSrc"],
  ["측정 상태", "status"],
  ["측정 완료일", "doneAt"],
  ["예상 기대효과", "fit"],
  ["명세 명확성", "spec"],
  ["맥락 주입 가능성", "ctx"],
  ["생성 패턴", "gen"],
  ["요구사항명", "name"],
  ["업무 유형", "workType"],
];

export const MAP_COLS: Col<"tag" | "userId">[] = [
  ["공수 태그", "tag"],
  ["사번", "userId"],
];

export const DEV_COLS: Col<"userId" | "userNm" | "hqNm" | "deptNm" | "role" | "aiAcct">[] = [
  ["사번", "userId"],
  ["성명", "userNm"],
  ["SK AX 본부", "hqNm"],
  ["SK AX 팀", "deptNm"],
  ["권한", "role"],
  ["AI 도구 계정", "aiAcct"],
];

export const GRADE_COLS: Col<"grade" | "mm" | "md">[] = [
  ["등급", "grade"],
  ["단가(원/MM)", "mm"],
  ["단가(원/MD)", "md"],
];

export const TOKEN_COLS: Col<"model" | "input" | "cached" | "output">[] = [
  ["모델", "model"],
  ["입력 단가(원/1M 토큰)", "input"],
  ["캐시 입력 단가(원/1M 토큰)", "cached"],
  ["출력 단가(원/1M 토큰)", "output"],
];

const ROLE_BY_LABEL: Record<string, Role> = { 개발자: "DEVELOPER", 관리자: "ADMIN", 열람자: "VIEWER" };
export const ROLE_TO_LABEL: Record<Role, string> = { DEVELOPER: "개발자", ADMIN: "관리자", VIEWER: "열람자" };
const STAGE_BY_ANY: Record<string, StageCd> = Object.fromEntries(STAGES.flatMap((c) => [[c, c], [STAGE_LABEL[c], c]]));

export interface PrjRow extends Record<(typeof PRJ_COLS)[number][1], string> {
  rowNo: number;
}
export interface TagRow {
  rowNo: number;
  tag: string;
  prjId: string;
  reqId: string;
  stage: StageCd;
  difficulty: string;
  grade: string;
  baseMd: number;
  baseSrc: string;
  done: boolean;
  doneAt: string | null;
  fit: string;
  spec: string;
  ctx: string;
  gen: string;
  /** 열이 없으면 null — 기존 값을 지우지 않는다 */
  name: string | null;
  workType: string | null;
}
export interface DevRow {
  rowNo: number;
  userId: string;
  userNm: string;
  hqNm: string;
  deptNm: string;
  role: Role;
  aiAcct: string;
}
export interface WorkbookData {
  projects: PrjRow[];
  tags: TagRow[];
  mapping: { rowNo: number; tag: string; userId: string }[];
  devs: DevRow[];
  grades: { grade: string; mm: number; md: number }[];
  tokens: { model: string; input: number; cached: number; output: number }[];
}
export interface WbError {
  sheet: string;
  rowNo: number;
  message: string;
}

const norm = (v: string) => v.replace(/\s+/g, "").toLowerCase();

/** 머리글 행을 찾아 그 아래 빈 줄 전까지 읽는다. 시트 하나에 표가 여럿(03·04)이어서 첫 머리글로 표를 고른다. */
function readTable<K extends string>(grid: string[][], cols: Col<K>[], need: number): { rows: { rowNo: number; v: Record<K, string>; has: Set<K> }[] } | null {
  const first = norm(cols[0][0]);
  const second = norm(cols[1][0]);
  const h = grid.findIndex((r) => r.some((c, i) => norm(c ?? "") === first && norm(r[i + 1] ?? "") === second));
  if (h < 0) return null;
  const idx = new Map<K, number>();
  grid[h].forEach((c, i) => {
    const col = cols.find(([head]) => norm(head) === norm(c ?? ""));
    if (col && !idx.has(col[1])) idx.set(col[1], i);
  });
  if (idx.size < need) return null;
  const rows: { rowNo: number; v: Record<K, string>; has: Set<K> }[] = [];
  for (let i = h + 1; i < grid.length; i++) {
    const r = grid[i] ?? [];
    const v = Object.fromEntries(cols.map(([, k]) => [k, idx.has(k) ? (r[idx.get(k)!] ?? "").trim() : ""])) as Record<K, string>;
    if (Object.values(v).every((x) => !x)) break;
    rows.push({ rowNo: i + 1, v, has: new Set(idx.keys()) });
  }
  return { rows };
}

const ID_RE = /^[A-Za-z0-9_]{1,20}$/;
const USER_RE = /^[A-Za-z0-9._-]{2,50}$/;
const toNum = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(/,/g, "")));
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * 5개 시트를 검사해 읽는다. 오류가 하나라도 있으면 호출 쪽이 아무것도 저장하지 않는다 — 일부만 들어가면 엑셀과 포털이 어긋난 채 남는다.
 * known: 이미 포털에 있는 과제 ID·공수 태그·사번 — 파일에 없어도 참조할 수 있다.
 */
export function parseWorkbook(grids: Partial<Record<SheetKey, string[][]>>, known: { prjIds: Set<string>; tags: Set<string>; userIds: Set<string> }): { data: WorkbookData; errors: WbError[] } {
  const errors: WbError[] = [];
  const data: WorkbookData = { projects: [], tags: [], mapping: [], devs: [], grades: [], tokens: [] };
  const fail = (sheet: SheetKey, rowNo: number, message: string) => errors.push({ sheet: SHEETS[sheet], rowNo, message });

  const prjT = grids.prj && readTable(grids.prj, PRJ_COLS, 2);
  if (grids.prj && !prjT) fail("prj", 0, "'과제 ID'·'하이닉스 과제명' 머리글을 찾지 못했습니다.");
  const seenPrj = new Map<string, number>();
  for (const { rowNo, v } of prjT?.rows ?? []) {
    if (!ID_RE.test(v.prjId)) fail("prj", rowNo, `과제 ID '${v.prjId}' — 영문·숫자·_ 20자 이내로 적어 주세요(하이픈 불가, 공수 태그 구분자).`);
    else if (seenPrj.has(v.prjId)) fail("prj", rowNo, `과제 ID ${v.prjId} 가 ${seenPrj.get(v.prjId)}행과 중복됩니다.`);
    if (!v.prjNm) fail("prj", rowNo, "하이닉스 과제명이 비어 있습니다.");
    seenPrj.set(v.prjId, rowNo);
    data.projects.push({ rowNo, ...v });
  }
  const prjIds = new Set([...Array.from(known.prjIds), ...data.projects.map((p) => p.prjId)]);

  const tagT = grids.tag && readTable(grids.tag, TAG_COLS, 4);
  if (grids.tag && !tagT) fail("tag", 0, "'공수 태그'·'과제 ID' 머리글을 찾지 못했습니다.");
  const seenTag = new Map<string, number>();
  for (const { rowNo, v, has } of tagT?.rows ?? []) {
    const stage = STAGE_BY_ANY[v.stage.toUpperCase()] ?? STAGE_BY_ANY[v.stage];
    const md = toNum(v.baseMd);
    const before = errors.length;
    if (!prjIds.has(v.prjId)) fail("tag", rowNo, `과제 ID '${v.prjId}' 가 '01. 과제' 시트·포털에 없습니다.`);
    if (!v.reqId) fail("tag", rowNo, "요구사항 ID 가 비어 있습니다.");
    else if (/\s/.test(v.reqId)) fail("tag", rowNo, `요구사항 ID '${v.reqId}' 에 공백이 있습니다.`);
    if (!stage) fail("tag", rowNo, `단계 '${v.stage}' — ${STAGES.join("·")} 중 하나입니다.`);
    if (!Number.isFinite(md) || md < 0) fail("tag", rowNo, `기준 공수 '${v.baseMd}' 가 0 이상 숫자가 아닙니다.`);
    const done = v.status === "완료";
    if (v.doneAt && !isDate(v.doneAt)) fail("tag", rowNo, `측정 완료일 '${v.doneAt}' 을(를) 날짜로 읽지 못했습니다.`);
    if (errors.length > before || !stage) continue;
    const tag = unitCode(v.prjId, v.reqId, stage);
    if (v.tag && v.tag.toUpperCase() !== tag.toUpperCase()) {
      fail("tag", rowNo, `공수 태그 '${v.tag}' 가 과제 ID·요구사항 ID·단계로 만든 '${tag}' 와 다릅니다.`);
      continue;
    }
    if (seenTag.has(tag)) {
      fail("tag", rowNo, `공수 태그 ${tag} 가 ${seenTag.get(tag)}행과 중복됩니다.`);
      continue;
    }
    seenTag.set(tag, rowNo);
    data.tags.push({
      rowNo,
      tag,
      prjId: v.prjId,
      reqId: v.reqId,
      stage,
      difficulty: v.difficulty,
      grade: v.grade,
      baseMd: md,
      baseSrc: v.baseSrc,
      done,
      doneAt: done ? v.doneAt || null : null,
      fit: v.fit,
      spec: v.spec,
      ctx: v.ctx,
      gen: v.gen,
      name: has.has("name") ? v.name : null,
      workType: has.has("workType") ? v.workType : null,
    });
  }
  const tags = new Set([...Array.from(known.tags), ...data.tags.map((t) => t.tag)]);

  const devT = grids.map && readTable(grids.map, DEV_COLS, 2);
  const seenUser = new Map<string, number>();
  const seenAcct = new Map<string, string>();
  for (const { rowNo, v } of devT?.rows ?? []) {
    // 원본 양식의 입력 안내 줄(권한 '개발자/관리자', 'oTel 계정 Key')은 사번·성명이 비어 있다.
    if (!v.userId && !v.userNm) continue;
    const role = ROLE_BY_LABEL[v.role || "개발자"];
    if (!USER_RE.test(v.userId)) fail("map", rowNo, `사번 '${v.userId}' — 영문·숫자·._- 2~50자로 적어 주세요.`);
    else if (seenUser.has(v.userId)) fail("map", rowNo, `사번 ${v.userId} 가 ${seenUser.get(v.userId)}행과 중복됩니다.`);
    if (!v.userNm) fail("map", rowNo, "성명이 비어 있습니다.");
    if (!role) fail("map", rowNo, `권한 '${v.role}' — 개발자·관리자·열람자 중 하나입니다.`);
    const acct = v.aiAcct.toLowerCase();
    if (acct && seenAcct.has(acct)) fail("map", rowNo, `AI 도구 계정 ${v.aiAcct} 가 ${seenAcct.get(acct)} 와 겹칩니다.`);
    seenUser.set(v.userId, rowNo);
    if (acct) seenAcct.set(acct, v.userId);
    data.devs.push({ rowNo, userId: v.userId, userNm: v.userNm, hqNm: v.hqNm, deptNm: v.deptNm, role: role ?? "DEVELOPER", aiAcct: v.aiAcct });
  }
  const userIds = new Set([...Array.from(known.userIds), ...data.devs.map((d) => d.userId)]);

  const mapT = grids.map && readTable(grids.map, MAP_COLS, 2);
  const seenMap = new Map<string, number>();
  for (const { rowNo, v } of mapT?.rows ?? []) {
    const tag = v.tag.toUpperCase();
    const hit = Array.from(tags).find((t) => t.toUpperCase() === tag);
    if (!hit) fail("map", rowNo, `공수 태그 '${v.tag}' 가 '02. 요구사항-SDLC' 시트·포털에 없습니다.`);
    else if (seenMap.has(hit)) fail("map", rowNo, `공수 태그 ${hit} 가 ${seenMap.get(hit)}행과 중복됩니다 — 태그 하나에 개발자 한 명입니다.`);
    if (v.userId && !userIds.has(v.userId)) fail("map", rowNo, `사번 '${v.userId}' 가 '개발자 권한 관리' 표·포털 계정에 없습니다.`);
    if (hit) {
      seenMap.set(hit, rowNo);
      data.mapping.push({ rowNo, tag: hit, userId: v.userId });
    }
  }

  const gT = grids.base && readTable(grids.base, GRADE_COLS, 2);
  for (const { rowNo, v } of gT?.rows ?? []) {
    if (!v.grade) continue;
    const md = toNum(v.md);
    const mm = v.mm ? toNum(v.mm) : 0;
    // 단가를 아직 안 적은 등급 줄(원본 양식)은 건너뛴다 — 기존 단가를 0 으로 덮지 않게.
    if (!v.md && !v.mm) continue;
    if (!Number.isFinite(md) || md < 0) fail("base", rowNo, `${v.grade} 단가(원/MD) '${v.md}' 가 0 이상 숫자가 아닙니다. 계산은 M/D 단가로 합니다.`);
    else if (!Number.isFinite(mm) || mm < 0) fail("base", rowNo, `${v.grade} 단가(원/MM) '${v.mm}' 가 0 이상 숫자가 아닙니다.`);
    else data.grades.push({ grade: v.grade, mm, md });
  }
  const tT = grids.base && readTable(grids.base, TOKEN_COLS, 4);
  for (const { rowNo, v } of tT?.rows ?? []) {
    if (!v.model) continue;
    const p = { input: toNum(v.input), cached: v.cached ? toNum(v.cached) : 0, output: toNum(v.output) };
    if (Object.values(p).some((x) => !Number.isFinite(x) || x < 0)) fail("base", rowNo, `${v.model} 토큰 단가가 0 이상 숫자가 아닙니다.`);
    else data.tokens.push({ model: v.model, ...p });
  }
  return { data, errors: errors.sort((a, b) => a.sheet.localeCompare(b.sheet) || a.rowNo - b.rowNo) };
}

/** 내보내기 표 — 시트 이름 → 여러 표(제목·머리글·행). 원본처럼 B2 부터 쓴다. */
export interface OutTable {
  title?: string;
  head: string[];
  rows: (string | number | null)[][];
}

const STATUS_LABEL = { DONE: "완료", ING: "측정 중", WAIT: "대기" } as const;

export function workbookTables(
  projects: Project[],
  users: UserRecord[],
  settings: Settings,
  metrics: MetricDef[],
  statusOf: (code: string) => keyof typeof STATUS_LABEL,
): Record<SheetKey, OutTable[]> {
  const tags = projects.flatMap((p) => p.reqs.flatMap((r) => r.stages.map((s) => ({ p, r, s, code: unitCode(p.prjId, r.reqId, s.cd) }))));
  return {
    prj: [{ head: PRJ_COLS.map((c) => c[0]), rows: projects.map((p) => PRJ_COLS.map(([, k]) => p[k] || null)) }],
    tag: [
      {
        head: TAG_COLS.map((c) => c[0]),
        rows: tags.map(({ r, s, code, p }) => [
          code,
          p.prjId,
          r.reqId,
          s.cd,
          s.difficulty || null,
          s.grade || null,
          s.baseMd,
          s.baseSrc || null,
          STATUS_LABEL[statusOf(code)],
          s.done && s.doneAt ? s.doneAt.slice(0, 10) : null,
          s.fit || null,
          s.spec || null,
          s.ctx || null,
          s.gen || null,
          r.name && r.name !== r.reqId ? r.name : null,
          s.workType || null,
        ]),
      },
    ],
    map: [
      { title: "공수 태그 - 개발자 Mapping", head: MAP_COLS.map((c) => c[0]), rows: tags.map(({ s, code }) => [code, s.ownerId]) },
      {
        title: "개발자 권한 관리",
        head: DEV_COLS.map((c) => c[0]),
        rows: users.filter((u) => u.useYn).map((u) => [u.userId, u.userNm, u.hqNm || null, u.deptNm || null, ROLE_TO_LABEL[u.role], u.aiAcct || null]),
      },
    ],
    base: [
      {
        title: "인건비 단가 표",
        head: GRADE_COLS.map((c) => c[0]),
        rows: Object.keys({ ...settings.gradePrice, ...settings.gradePriceMm }).map((g) => [g, settings.gradePriceMm[g] || null, settings.gradePrice[g] ?? null]),
      },
      {
        title: "토큰 단가 표",
        head: TOKEN_COLS.map((c) => c[0]),
        rows: Object.entries(settings.tokenPrice).map(([m, p]) => [m, p.input, p.cached, p.output]),
      },
    ],
    logic: [{ title: "주요 집계 로직", head: ["구분", "지표", "상세 로직 (입력 데이터.항목 기준)", "포털 기준"], rows: metrics.map((m) => [m.group, m.name, m.formula, m.note || null]) }],
  };
}

export async function readWorkbookGrids(buf: ArrayBuffer): Promise<Partial<Record<SheetKey, string[][]>>> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const out: Partial<Record<SheetKey, string[][]>> = {};
  for (const [key, name] of Object.entries(SHEETS) as [SheetKey, string][]) {
    // 시트 이름을 조금 바꿔도 앞 번호(01. …)로 찾는다.
    const ws = wb.getWorksheet(name) ?? wb.worksheets.find((w) => w.name.trim().startsWith(name.slice(0, 3)));
    if (!ws) continue;
    const grid: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, no) => {
      const cells: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) cells.push(cellText(row.getCell(c).value, row.getCell(c).text));
      grid[no - 1] = cells;
    });
    out[key] = Array.from(grid, (r) => r ?? []);
  }
  return out;
}

/** 숫자는 원값, 날짜는 YYYY-MM-DD, 수식은 결과 — 표시 서식에 기준 공수가 잘리거나 날짜가 지역 형식으로 바뀌지 않게 */
function cellText(v: unknown, text: string): string {
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v && typeof v === "object" && "result" in v) return cellText((v as { result: unknown }).result, text);
  return (text ?? "").toString();
}

export function buildWorkbook(tables: Record<SheetKey, OutTable[]>): Promise<ArrayBuffer> {
  return writeSheets((Object.entries(SHEETS) as [SheetKey, string][]).map(([key, name]) => ({ name, tables: tables[key] })));
}

/** 시트마다 표를 위에서부터 한 칸씩 띄워 쌓는다 — 기준정보 양식과 측정 결과 내려받기가 같은 모양을 쓴다 */
export async function writeSheets(sheets: { name: string; tables: OutTable[] }[]): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  for (const sh of sheets) {
    const ws = wb.addWorksheet(sh.name);
    let r = 2;
    for (const t of sh.tables) {
      if (t.title) {
        ws.getCell(r, 2).value = t.title;
        ws.getCell(r, 2).font = { bold: true };
        r++;
      }
      t.head.forEach((h, i) => {
        const c = ws.getCell(r, 2 + i);
        c.value = h;
        c.font = { bold: true };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
        c.border = { bottom: { style: "thin" } };
      });
      r++;
      for (const row of t.rows) {
        row.forEach((v, i) => {
          if (v !== null && v !== "") ws.getCell(r, 2 + i).value = v;
        });
        r++;
      }
      r++;
    }
    (ws.columns ?? []).forEach((col, i) => {
      if (i === 0) col.width = 2;
      else col.width = Math.min(48, Math.max(10, ...sh.tables.flatMap((t) => [t.head[i - 1] ?? "", ...t.rows.map((x) => String(x[i - 1] ?? ""))]).map((s) => s.length * 1.6)));
    });
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
