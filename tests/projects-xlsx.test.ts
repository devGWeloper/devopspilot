import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import { defaultCodes, defaultCriteria } from "@/lib/criteria/defaults";
import { sampleProjects } from "@/lib/criteria/samples";
import { buildProjectsWorkbook } from "@/lib/export/projectsXlsx";

it("시트 3개, 과제 행 수, 적합도 표기", async () => {
  const c = defaultCriteria();
  const ps = sampleProjects(c, "2026-10-08T00:00:00.000Z");
  const buf = await buildProjectsWorkbook(ps, c, defaultCodes());
  expect(buf.subarray(0, 2).toString()).toBe("PK");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  expect(wb.worksheets.map((w) => w.name)).toEqual(["과제 목록", "지표 응답", "평가 기준"]);
  const list = wb.getWorksheet("과제 목록")!;
  expect(list.rowCount).toBe(ps.length + 1);
  const header = (list.getRow(1).values as unknown[]).filter(Boolean);
  expect(header).toContain("확정 적합도");
  expect(String(list.getRow(2).getCell(1).value)).toBe("PRJ-0001");
  const matrix = wb.getWorksheet("지표 응답")!;
  expect(matrix.rowCount).toBe(ps.length + 2);
});
