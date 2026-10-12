import { describe, expect, it } from "vitest";
import { defaultCodes, defaultCriteria } from "@/lib/criteria/defaults";
import { dimensions, distribute } from "@/lib/distribution";
import { mkProject } from "./helpers";

const c = defaultCriteria();
const codes = defaultCodes();
const dim = (k: string) => dimensions(codes).find((d) => d.key === k)!;

describe("distribute", () => {
  const ps = [
    mkProject({ prjId: "P1", status: "SELECTED", mainLangCd: "JAVA", finalFit: "H" }),
    mkProject({ prjId: "P2", status: "SELECTED", mainLangCd: "JAVA", finalFit: "M" }),
    mkProject({ prjId: "P3", status: "REVIEW", mainLangCd: "PYTHON", finalFit: "L" }),
    mkProject({ prjId: "P4", status: "EXCLUDED", mainLangCd: "C_CPP", finalFit: "L" }),
  ];

  it("후보는 제외 과제를 빼고, 선정은 지정 상태만 센다", () => {
    const r = distribute(ps, dim("lang"), ["SELECTED"]);
    const java = r.rows.find((x) => x.code === "JAVA")!;
    expect(java).toMatchObject({ candidates: 2, chosen: 2, chosenIds: ["P1", "P2"] });
    expect(r.rows.find((x) => x.code === "C_CPP")!.candidates).toBe(0);
    expect(r).toMatchObject({ available: 2, covered: 1, gaps: ["Python"], topShare: 1, topLabel: "Java" });
  });

  it("적합도 축은 확정값 우선", () => {
    const r = distribute(ps, dim("fit"), ["SELECTED", "REVIEW"]);
    expect(r.rows.map((x) => x.chosen)).toEqual([1, 1, 1]);
    expect(r.gaps).toEqual([]);
  });

  it("선정 0건이면 쏠림 없음", () => {
    expect(distribute(ps, dim("lang"), ["RESERVE"])).toMatchObject({ covered: 0, topShare: 0, topLabel: null });
  });

  it("시스템 등급은 base 값으로 분류", () => {
    const p = mkProject({ prjId: "G", status: "SELECTED" });
    p.base.sysGradeCd = "L0";
    expect(distribute([p], dim("sysGrade"), ["SELECTED"]).rows[0]).toMatchObject({ code: "L0", chosen: 1 });
  });
});
