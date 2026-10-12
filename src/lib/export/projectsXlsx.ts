import ExcelJS from "exceljs";
import { effectiveFit } from "../balance";
import { evaluateFit, FIT_LABEL, highRuleLabel } from "../fitness";
import { AGREE_LABEL, STATUS_LABEL } from "../labels";
import { ENTRY_FIELDS } from "../projects/fields";
import { entryProgress, toInput } from "../projects/validate";
import type { Codes, Criteria, Fit, Level, Project } from "../types";

const FILL: Record<Fit, string> = { H: "FFE3F1EB", M: "FFF8EEDD", L: "FFF6E4E2", NA: "FFEEEFF1" };
const FONT: Record<Fit, string> = { H: "FF1E7A5A", M: "FF8A5A12", L: "FFB4443C", NA: "FF8A8F98" };
const HEAD_FILL = "FF14213D";

function styleHeader(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
}

function paintFit(cell: ExcelJS.Cell, f: Fit) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL[f] } };
  cell.font = { bold: true, color: { argb: FONT[f] } };
  cell.alignment = { horizontal: "center" };
}

const label = (list: { code: string; label: string }[], code: string | null) => list.find((x) => x.code === code)?.label ?? code ?? "";

interface Col {
  ref: string;
  header: string;
  width: number;
  value: (p: Project) => string | number | null;
  fit?: (p: Project) => Fit | null;
}

const GROUP_ORDER = ["PRJ", "AIS", "FIT", "REF"];
const refKey = (ref: string) => [GROUP_ORDER.indexOf(ref.slice(0, 3)), ref];

// 과제 선정 양식(엑셀)과 같은 항목 ID·순서로 내보내, 양식으로 받던 사람이 그대로 대조할 수 있게 한다.
function listColumns(c: Criteria, codes: Codes): Col[] {
  const head = (ref: string, name: string) => (ref ? `${ref}
${name}` : name);
  const formCols: Col[] = [];
  for (const f of ENTRY_FIELDS.filter((x) => !x.portal)) {
    formCols.push({
      ref: f.ref,
      header: head(f.ref, f.name),
      width: f.kind === "textarea" ? 40 : f.key === "prjNm" ? 30 : 16,
      value: (p) => {
        const v = f.key === "prjNm" || f.key === "sysNm" ? p[f.key] : p.base[f.key];
        if (f.kind === "code" && f.codes) return label(codes[f.codes], (v as string) || null);
        if (f.kind === "level") return v ? FIT_LABEL[v as Level] : "";
        return (v as string | number | null) ?? "";
      },
      fit: f.kind === "level" ? (p) => (p.base.pmFit ? p.base.pmFit : null) : undefined,
    });
  }
  for (const i of c.areas.flatMap((a) => a.indicators).filter((x) => x.ref)) {
    formCols.push({ ref: i.ref!, header: head(i.ref!, i.name), width: 14, value: (p) => i.options.find((o) => o.id === p.eval.answers[i.id])?.label ?? "" });
  }
  formCols.push({ ref: "PRJ-05", header: head("PRJ-05", "작성자 (PM)"), width: 10, value: (p) => p.pmUserNm });
  formCols.push({
    ref: "FIT-05",
    header: head("FIT-05", "참고 등급"),
    width: 22,
    value: (p) => {
      const ev = evaluateFit(c, p.eval.answers);
      return ev.suggest === "NA" ? "" : `${FIT_LABEL[ev.suggest]}${ev.bottleneck.length ? ` (병목: ${ev.bottleneck.join(", ")})` : ""}`;
    },
    fit: (p) => p.suggestFit,
  });
  formCols.push({ ref: "REF-05", header: head("REF-05", "필수 입력 완료율"), width: 10, value: (p) => `${Math.floor(entryProgress(toInput(p), c).rate * 100)}%` });
  formCols.sort((a, b) => {
    const [ga, ra] = refKey(a.ref);
    const [gb, rb] = refKey(b.ref);
    return ga !== gb ? (ga as number) - (gb as number) : String(ra).localeCompare(String(rb));
  });

  const extraInds = c.areas.flatMap((a) => a.indicators).filter((x) => !x.ref);
  return [
    { ref: "", header: "과제코드", width: 11, value: (p) => p.prjId },
    { ref: "", header: "상태", width: 9, value: (p) => STATUS_LABEL[p.status] },
    ...formCols,
    ...extraInds.map((i) => ({ ref: "", header: i.name, width: 14, value: (p: Project) => i.options.find((o) => o.id === p.eval.answers[i.id])?.label ?? "" })),
    ...ENTRY_FIELDS.filter((x) => x.portal).map((f) => ({
      ref: "",
      header: `${f.name} (포털)`,
      width: f.kind === "textarea" ? 40 : 18,
      value: (p: Project) => (f.kind === "codes" && f.codes ? p.base.langCds.map((l) => label(codes[f.codes!], l)).join(", ") : String(p.base[f.key as "techStack"] ?? "")),
    })),
    { ref: "", header: "수행 기간 (포털)", width: 22, value: (p) => (p.base.baseline.startDate || p.base.baseline.endDate ? `${p.base.baseline.startDate ?? ""} ~ ${p.base.baseline.endDate ?? ""}` : "") },
    { ref: "", header: "총 공수 M/M (포털)", width: 12, value: (p) => p.base.baseline.totalMm },
    { ref: "", header: "확정 적합도", width: 10, value: (p) => (p.finalFit === "NA" ? "" : FIT_LABEL[p.finalFit]), fit: (p) => (p.finalFit === "NA" ? null : p.finalFit) },
    { ref: "", header: "집계 적합도", width: 10, value: (p) => FIT_LABEL[effectiveFit(p)], fit: (p) => effectiveFit(p) },
    { ref: "", header: "확정 사유", width: 28, value: (p) => p.eval.confirm?.reason ?? "" },
    { ref: "", header: "AX 합의", width: 9, value: (p) => AGREE_LABEL[p.axAgree] },
    { ref: "", header: "HX 합의", width: 9, value: (p) => AGREE_LABEL[p.hxAgree] },
    { ref: "", header: "상태 사유", width: 28, value: (p) => p.statusNote ?? "" },
  ];
}

export async function buildProjectsWorkbook(projects: Project[], c: Criteria, codes: Codes): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AI 활용 생산성 향상 PoC 포털";
  wb.created = new Date();
  const inds = c.areas.flatMap((a) => a.indicators.map((i) => ({ ...i, areaName: a.name })));
  const cols = listColumns(c, codes);

  const ws = wb.addWorksheet("과제 목록", { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  ws.columns = cols.map((x, i) => ({ header: x.header, key: `c${i}`, width: x.width }));
  styleHeader(ws.getRow(1));
  ws.getRow(1).height = 36;
  for (const p of projects) {
    const row = ws.addRow(Object.fromEntries(cols.map((x, i) => [`c${i}`, x.value(p)])));
    cols.forEach((x, i) => x.fit && x.fit(p) && paintFit(row.getCell(i + 1), x.fit(p)!));
    row.alignment = { vertical: "top", wrapText: false };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  const mx = wb.addWorksheet("지표 응답", { views: [{ state: "frozen", xSplit: 3, ySplit: 2 }] });
  const areaRow = mx.addRow(["", "", "", ...inds.map((i) => i.areaName)]);
  const headRow = mx.addRow(["과제코드", "과제명", "참고 등급", ...inds.map((i) => `${i.ref ? `${i.ref} ` : ""}${i.name}${i.tier === "MAJOR" ? " ★" : ""}`)]);
  styleHeader(areaRow);
  styleHeader(headRow);
  headRow.height = 44;
  mx.getColumn(1).width = 11;
  mx.getColumn(2).width = 28;
  mx.getColumn(3).width = 7;
  inds.forEach((_, i) => (mx.getColumn(i + 4).width = 14));
  for (const p of projects) {
    const row = mx.addRow([
      p.prjId,
      p.prjNm,
      FIT_LABEL[p.suggestFit],
      ...inds.map((i) => i.options.find((o) => o.id === p.eval.answers[i.id])?.label ?? ""),
    ]);
    paintFit(row.getCell(3), p.suggestFit);
  }

  const cr = wb.addWorksheet("평가 기준");
  cr.columns = [
    { header: "영역", key: "area", width: 16 },
    { header: "지표", key: "ind", width: 24 },
    { header: "구분", key: "tier", width: 8 },
    { header: "설명", key: "desc", width: 40 },
    { header: "선택지 (수준)", key: "opts", width: 60 },
  ];
  styleHeader(cr.getRow(1));
  for (const i of inds) {
    const row = cr.addRow({
      area: i.areaName,
      ind: i.name,
      tier: i.tier === "MAJOR" ? "Major" : "Minor",
      desc: i.description,
      opts: i.options.map((o) => `${o.label}(${FIT_LABEL[o.level]})`).join(" / "),
    });
    if (i.tier === "MAJOR") row.getCell("tier").font = { bold: true, color: { argb: "FF2B3A8C" } };
  }
  cr.addRow([]);
  const r = c.rule;
  const high = highRuleLabel(r);
  cr.addRow([`판정 규칙 (평가 기준 v${c.version})`]).font = { bold: true };
  cr.addRow([`하: Major 지표 중 하가 ${r.lowMinMajorLow}개 이상`]);
  cr.addRow([`상: Major 지표 중 하가 ${r.highMaxMajorLow}개 이하이고 상이 ${high} 이상`]);
  cr.addRow(["중: 그 외 / Major 미응답이 있으면 미평가 / Minor 는 판정에 영향 없음"]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
