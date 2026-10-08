import { effectiveFit } from "./balance";
import type { Criteria, Fit, Indicator, Project, Tier } from "./types";

export interface MatrixColumn {
  indicator: Indicator;
  tier: Tier;
  areaName: string;
  areaIndex: number;
}

// 판정은 Major 만으로 하므로 Major 를 왼쪽 한 덩어리로 모아, 표만 보고도 "무엇으로 판정했는지"가 읽히게 한다.
export function matrixColumns(c: Criteria): MatrixColumn[] {
  const all = c.areas.flatMap((a, areaIndex) => a.indicators.map((indicator) => ({ indicator, tier: indicator.tier, areaName: a.name, areaIndex })));
  return [...all.filter((x) => x.tier === "MAJOR"), ...all.filter((x) => x.tier === "MINOR")];
}

const FIT_ORDER: Record<Fit, number> = { H: 0, M: 1, L: 2, NA: 3 };
const STATUS_ORDER: Record<string, number> = { SELECTED: 0, RESERVE: 1, REVIEW: 2, SUBMITTED: 3, SUPPLEMENT: 4, DRAFT: 5, EXCLUDED: 6 };

export function matrixRows(projects: Project[], includeExcluded: boolean): Project[] {
  return projects
    .filter((p) => includeExcluded || p.status !== "EXCLUDED")
    .sort(
      (a, b) =>
        FIT_ORDER[effectiveFit(a)] - FIT_ORDER[effectiveFit(b)] ||
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.prjId.localeCompare(b.prjId),
    );
}
