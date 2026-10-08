import ExcelJS from "exceljs";
import { effectiveFit } from "../balance";
import { FIT_LABEL } from "../fitness";
import { AGREE_LABEL, STATUS_LABEL } from "../labels";
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

export async function buildProjectsWorkbook(projects: Project[], c: Criteria, codes: Codes): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AI 활용 생산성 향상 PoC 포털";
  wb.created = new Date();
  const inds = c.areas.flatMap((a) => a.indicators.map((i) => ({ ...i, areaName: a.name })));
  const devInd = inds.find((i) => i.id === "devType");

  const ws = wb.addWorksheet("과제 목록", { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  ws.columns = [
    { header: "과제코드", key: "id", width: 11 },
    { header: "과제명", key: "nm", width: 32 },
    { header: "시스템명", key: "sys", width: 16 },
    { header: "PM", key: "pm", width: 10 },
    { header: "상태", key: "st", width: 9 },
    { header: "제안 적합도", key: "sug", width: 10 },
    { header: "확정 적합도", key: "fin", width: 10 },
    { header: "집계 적합도", key: "eff", width: 10 },
    { header: "확정 사유", key: "reason", width: 28 },
    { header: "응답", key: "ans", width: 8 },
    { header: "개발 성격", key: "dev", width: 10 },
    { header: "업무 도메인", key: "dom", width: 12 },
    { header: "시스템 유형", key: "stype", width: 12 },
    { header: "개발 언어", key: "lang", width: 22 },
    { header: "기술 스택", key: "tech", width: 24 },
    { header: "수행 기간", key: "period", width: 22 },
    { header: "총 공수(M/M)", key: "mm", width: 11 },
    { header: "AX 합의", key: "ax", width: 9 },
    { header: "HX 합의", key: "hx", width: 9 },
    { header: "상태 사유", key: "note", width: 28 },
    { header: "과제 설명", key: "desc", width: 48 },
  ];
  styleHeader(ws.getRow(1));
  for (const p of projects) {
    const bl = p.base.baseline;
    const row = ws.addRow({
      id: p.prjId,
      nm: p.prjNm,
      sys: p.sysNm,
      pm: p.pmUserNm,
      st: STATUS_LABEL[p.status],
      sug: FIT_LABEL[p.suggestFit],
      fin: p.finalFit === "NA" ? "" : FIT_LABEL[p.finalFit],
      eff: FIT_LABEL[effectiveFit(p)],
      reason: p.eval.confirm?.reason ?? "",
      ans: `${p.answerCnt}/${p.indicatorCnt}`,
      dev: devInd?.options.find((o) => o.id === p.devTypeCd)?.label ?? "",
      dom: label(codes.domains, p.domainCd),
      stype: label(codes.sysTypes, p.sysTypeCd),
      lang: p.base.langCds.map((l) => label(codes.langs, l)).join(", "),
      tech: p.base.techStack,
      period: bl.startDate || bl.endDate ? `${bl.startDate ?? ""} ~ ${bl.endDate ?? ""}` : "",
      mm: bl.totalMm,
      ax: AGREE_LABEL[p.axAgree],
      hx: AGREE_LABEL[p.hxAgree],
      note: p.statusNote ?? "",
      desc: p.base.description,
    });
    paintFit(row.getCell("sug"), p.suggestFit);
    if (p.finalFit !== "NA") paintFit(row.getCell("fin"), p.finalFit);
    paintFit(row.getCell("eff"), effectiveFit(p));
    row.alignment = { vertical: "top", wrapText: false };
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

  const mx = wb.addWorksheet("지표 응답", { views: [{ state: "frozen", xSplit: 3, ySplit: 2 }] });
  const areaRow = mx.addRow(["", "", "", ...inds.map((i) => i.areaName)]);
  const headRow = mx.addRow(["과제코드", "과제명", "제안", ...inds.map((i) => `${i.name}${i.tier === "MAJOR" ? " ★" : ""}`)]);
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
    inds.forEach((ind, k) => {
      const lv = ind.options.find((o) => o.id === p.eval.answers[ind.id])?.level as Level | undefined;
      if (lv) {
        const cell = row.getCell(k + 4);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL[lv] } };
        cell.font = { color: { argb: FONT[lv] } };
      }
    });
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
  const high = r.highMinMajorHigh === "half" ? "과반" : `${r.highMinMajorHigh}개`;
  cr.addRow([`판정 규칙 (평가 기준 v${c.version})`]).font = { bold: true };
  cr.addRow([`하: Major 지표 중 하가 ${r.lowMinMajorLow}개 이상`]);
  cr.addRow([`상: Major 지표 중 하가 ${r.highMaxMajorLow}개 이하이고 상이 ${high} 이상`]);
  cr.addRow(["중: 그 외 / Major 미응답이 있으면 미평가 / Minor 는 판정에 영향 없음"]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
