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

it("파일이 없으면 db null, llm 비활성", () => {
  const c = loadConfig();
  expect(c.db).toBeNull();
  expect(c.llm.enabled).toBe(false);
});

it("db 값이 하나라도 비면 null", () => {
  writeFileSync("config.yml", ["db:", '  user: "a"', '  password: ""', '  connectString: "h:1/s"'].join("\n"));
  expect(loadConfig().db).toBeNull();
});

it("db·llm 값 읽기", () => {
  writeFileSync(
    "config.yml",
    [
      "db:",
      '  user: "a"',
      '  password: "b"',
      '  connectString: "h:1521/s"',
      "llm:",
      "  enabled: true",
      '  baseUrl: "http://x"',
      '  apiKey: "k"',
      '  model: "m"',
    ].join("\n"),
  );
  const c = loadConfig();
  expect(c.db).toEqual({ user: "a", password: "b", connectString: "h:1521/s" });
  expect(c.llm).toMatchObject({ enabled: true, baseUrl: "http://x", model: "m", temperature: 0.2, timeoutMs: 60000 });
});

it("깨진 YAML 은 기본값", () => {
  writeFileSync("config.yml", "db: [unclosed");
  expect(loadConfig().db).toBeNull();
});
