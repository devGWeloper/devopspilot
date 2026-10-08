import { describe, it, expect } from "vitest";
import { analyzeBalance } from "@/lib/balance";
import { defaultCodes, defaultCriteria } from "@/lib/criteria/defaults";
import type { Fit, Project } from "@/lib/types";
import { mkProject } from "./helpers";

const c = defaultCriteria();
const codes = defaultCodes();

function sel(i: number, fit: Fit, dev: string, lang: string, extra: Partial<Project> = {}) {
  return mkProject({
    prjId: `PRJ-${i}`,
    status: "SELECTED",
    finalFit: fit,
    devTypeCd: dev,
    mainLangCd: lang,
    domainCd: "FAB",
    sysTypeCd: "WEB",
    ...extra,
  });
}

describe("analyzeBalance", () => {
  it("선정 0건이면 총량·적합도·개발 성격·언어 경고", () => {
    const r = analyzeBalance([], c, codes);
    expect(r.selectedCount).toBe(0);
    const kinds = r.warnings.map((w) => w.kind);
    expect(kinds.filter((k) => k === "TOTAL")).toHaveLength(1);
    expect(kinds.filter((k) => k === "FIT")).toHaveLength(3);
    expect(kinds.filter((k) => k === "DEV_TYPE")).toHaveLength(3);
    expect(kinds.filter((k) => k === "LANG")).toHaveLength(1);
    expect(r.warnings.map((w) => w.message)).toContain("개발 성격 '레거시' 선정 0건");
  });

  it("목표를 모두 채우면 경고 없음", () => {
    const fits: Fit[] = ["H", "H", "H", "M", "M", "M", "L", "L", "L"];
    const devs = ["new", "mixed", "legacy"];
    const langs = ["JAVA", "PYTHON", "PLSQL"];
    const ps = fits.map((f, i) => sel(i, f, devs[i % 3], langs[i % 3]));
    const r = analyzeBalance(ps, c, codes);
    expect(r.warnings).toEqual([]);
    expect(r.byFit).toMatchObject({ H: 3, M: 3, L: 3 });
    expect(r.byLang).toEqual({ JAVA: 3, PYTHON: 3, PLSQL: 3 });
  });

  it("적합도 부족 문장", () => {
    const r = analyzeBalance([sel(1, "L", "new", "JAVA")], c, codes);
    expect(r.warnings.map((w) => w.message)).toContain("하 적합도 목표 3건 중 1건");
    expect(r.warnings.map((w) => w.message)).toContain("선정 1건 (목표 9건)");
  });

  it("SELECTED 가 아닌 과제는 세지 않는다", () => {
    const r = analyzeBalance([sel(1, "H", "new", "JAVA", { status: "REVIEW" })], c, codes);
    expect(r.selectedCount).toBe(0);
  });

  it("확정 적합도가 없으면 제안 적합도로 센다", () => {
    const r = analyzeBalance([sel(1, "NA", "new", "JAVA", { suggestFit: "M" })], c, codes);
    expect(r.byFit.M).toBe(1);
  });

  it("상태 집합 지정 (예비 포함)", () => {
    const ps = [sel(1, "H", "new", "JAVA"), sel(2, "M", "new", "JAVA", { status: "RESERVE" })];
    expect(analyzeBalance(ps, c, codes, ["SELECTED", "RESERVE"]).selectedCount).toBe(2);
  });

  it("언어 종류 부족 문장", () => {
    const r = analyzeBalance([sel(1, "H", "new", "JAVA"), sel(2, "H", "new", "PYTHON")], c, codes);
    expect(r.warnings.map((w) => w.message)).toContain("언어 2종 (목표 3종 이상)");
  });
});
