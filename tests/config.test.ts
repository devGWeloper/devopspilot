import { it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { loadConfig, resetConfigCache } from "@/lib/config";

let cwd: string;
beforeEach(() => {
  cwd = process.cwd();
  process.chdir(mkdtempSync(path.join(tmpdir(), "poc-cfg-")));
  resetConfigCache();
});
afterEach(() => {
  process.chdir(cwd);
  resetConfigCache();
});

it("파일이 없으면 db null", () => {
  const c = loadConfig();
  expect(c.db).toBeNull();
});

it("db 값이 하나라도 비면 null", () => {
  writeFileSync("config.yml", ["db:", '  user: "a"', '  password: ""', '  connectString: "h:1/s"'].join("\n"));
  expect(loadConfig().db).toBeNull();
});

it("db 읽기", () => {
  writeFileSync(
    "config.yml",
    [
      "db:",
      '  user: "a"',
      '  password: "b"',
      '  connectString: "h:1521/s"',
    ].join("\n"),
  );
  const c = loadConfig();
  expect(c.db).toEqual({ user: "a", password: "b", connectString: "h:1521/s" });
});

it("깨진 YAML 은 기본값", () => {
  writeFileSync("config.yml", "db: [unclosed");
  expect(loadConfig().db).toBeNull();
});
