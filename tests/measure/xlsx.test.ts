import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildMeasureWorkbook, rawCsv } from "@/lib/export/measureXlsx";
import { computeMetrics } from "@/lib/measure/metrics";
import { sampleMeasureInput } from "@/lib/measure/sampleData";

it("시트 8개, 지표 요약에 절감률, 커밋 시트에 사후 수정 표시", async () => {
  const input = sampleMeasureInput();
  const buf = await buildMeasureWorkbook(input, computeMetrics(input), [{ prjId: "PRJ-0001", prjNm: "설비 이력" }]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  expect(wb.worksheets.map((w) => w.name)).toEqual(["지표 요약", "공수 기록표", "공수 기록", "결함", "AI 사용량", "커밋", "설정", "해석 주의사항"]);
  const sum = wb.getWorksheet("지표 요약")!;
  const texts = sum.getSheetValues().flat().map(String).join("|");
  expect(texts).toContain("공수 절감률");
  const ledger = wb.getWorksheet("공수 기록표")!;
  expect(ledger.rowCount).toBe(1 + 3 + 1);
  const commits = wb.getWorksheet("커밋")!;
  const flags = commits.getSheetValues().slice(2).map((r) => (r as unknown[])[9]);
  expect(flags.filter((f) => f === "Y")).toHaveLength(1);
});

it("원천 CSV — 종류별, BOM 포함", () => {
  const csv = rawCsv(sampleMeasureInput(), "commits");
  expect(csv.startsWith("﻿")).toBe(true);
  expect(csv.split("\r\n").filter(Boolean)).toHaveLength(8);
});
