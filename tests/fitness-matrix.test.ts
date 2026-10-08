import { it, expect } from "vitest";
import { defaultCriteria } from "@/lib/criteria/defaults";
import { matrixColumns, matrixRows } from "@/lib/fitnessMatrix";
import { mkProject } from "./helpers";

const c = defaultCriteria();

it("열: Major 블록이 먼저, 각 블록 안은 영역 순서 유지", () => {
  const cols = matrixColumns(c);
  expect(cols.map((x) => x.tier)).toEqual([...Array(8).fill("MAJOR"), ...Array(10).fill("MINOR")]);
  expect(cols.slice(0, 3).map((x) => x.indicator.id)).toEqual(["devType", "reqType", "risk"]);
  expect(cols[0]).toMatchObject({ areaName: "과제 특성", areaIndex: 0 });
});

it("행: 제외 과제 빼고, 적합도 상→중→하→미평가, 같은 적합도는 선정이 위", () => {
  const ps = [
    mkProject({ prjId: "A", suggestFit: "M", status: "REVIEW" }),
    mkProject({ prjId: "B", finalFit: "H", suggestFit: "M", status: "REVIEW" }),
    mkProject({ prjId: "C", suggestFit: "NA" }),
    mkProject({ prjId: "D", suggestFit: "H", status: "EXCLUDED" }),
    mkProject({ prjId: "E", suggestFit: "M", status: "SELECTED" }),
    mkProject({ prjId: "F", suggestFit: "L" }),
  ];
  expect(matrixRows(ps, false).map((p) => p.prjId)).toEqual(["B", "E", "A", "F", "C"]);
  expect(matrixRows(ps, true).map((p) => p.prjId)).toContain("D");
});
