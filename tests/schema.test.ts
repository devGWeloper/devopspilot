import { it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { TABLES, renderSqlFile } from "@/lib/store/schema";

it("테이블 5개", () => {
  expect(TABLES.map((t) => t.name)).toEqual(["POC_USER_MAS", "POC_PRJ_MAS", "POC_CFG_MAS", "POC_HIST_HIS", "POC_MEAS_DAT"]);
});

it("DDL 첫 문장은 해당 테이블 CREATE", () => {
  for (const t of TABLES) expect(t.ddl[0]).toMatch(new RegExp(`^CREATE TABLE ${t.name} \\(`));
});

it("DDL 에 세미콜론이 없다 (oracledb execute 는 단일 문장만 받는다)", () => {
  for (const t of TABLES) for (const s of t.ddl) expect(s.trim().endsWith(";")).toBe(false);
});

it("커밋된 sql/create_tables.sql 이 코드와 같다", () => {
  const file = readFileSync(path.join(__dirname, "..", "sql", "create_tables.sql"), "utf8").replace(/\r\n/g, "\n");
  expect(file).toBe(renderSqlFile());
});
