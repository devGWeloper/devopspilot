import { effectiveFit } from "./balance";
import { FIT_LABEL } from "./fitness";
import { LEVELS, type Codes, type Project, type ProjectStatus } from "./types";

export type DimKey = "fit" | "devType" | "domain" | "lang" | "sysType" | "sysGrade";

export interface Dimension {
  key: DimKey;
  title: string;
  cats: { code: string; label: string }[];
  of: (p: Project) => string | null;
}

export function dimensions(codes: Codes): Dimension[] {
  return [
    { key: "fit", title: "적합도", cats: LEVELS.map((lv) => ({ code: lv, label: FIT_LABEL[lv] })), of: (p) => (effectiveFit(p) === "NA" ? null : effectiveFit(p)) },
    { key: "devType", title: "과제 영역", cats: codes.workAreas, of: (p) => p.devTypeCd },
    { key: "sysType", title: "배포 형식", cats: codes.sysTypes, of: (p) => p.sysTypeCd },
    { key: "domain", title: "담당", cats: codes.domains, of: (p) => p.domainCd },
    { key: "sysGrade", title: "시스템 등급", cats: codes.sysGrades, of: (p) => p.base.sysGradeCd || null },
    { key: "lang", title: "주 개발 언어", cats: codes.langs, of: (p) => p.mainLangCd },
  ];
}

export interface DistRow {
  code: string;
  label: string;
  candidates: number;
  chosen: number;
  chosenIds: string[];
}

export interface DistSummary {
  dim: Dimension;
  rows: DistRow[];
  /** 후보가 있는 분류 수 — 선정이 덮을 수 있는 최대치 */
  available: number;
  /** 선정 과제가 1건 이상 있는 분류 수 */
  covered: number;
  /** 후보는 있는데 선정이 없는 분류 */
  gaps: string[];
  /** 선정 과제 중 한 분류에 가장 많이 몰린 비율(0~1) */
  topShare: number;
  topLabel: string | null;
}

// 후보 모집단 대비 선정이 어디를 덮고 어디를 비웠는지를 분류 축마다 같은 방식으로 센다.
export function distribute(projects: Project[], dim: Dimension, chosenStatuses: ProjectStatus[]): DistSummary {
  const pool = projects.filter((p) => p.status !== "EXCLUDED");
  const chosen = pool.filter((p) => chosenStatuses.includes(p.status));
  const rows: DistRow[] = dim.cats.map((cat) => {
    const inCat = chosen.filter((p) => dim.of(p) === cat.code);
    return {
      code: cat.code,
      label: cat.label,
      candidates: pool.filter((p) => dim.of(p) === cat.code).length,
      chosen: inCat.length,
      chosenIds: inCat.map((p) => p.prjId),
    };
  });
  const available = rows.filter((r) => r.candidates > 0).length;
  const covered = rows.filter((r) => r.chosen > 0).length;
  const top = rows.reduce<DistRow | null>((a, r) => (!a || r.chosen > a.chosen ? r : a), null);
  const totalChosen = rows.reduce((a, r) => a + r.chosen, 0);
  return {
    dim,
    rows,
    available,
    covered,
    gaps: rows.filter((r) => r.candidates > 0 && r.chosen === 0).map((r) => r.label),
    topShare: totalChosen ? (top?.chosen ?? 0) / totalChosen : 0,
    topLabel: totalChosen ? (top?.label ?? null) : null,
  };
}
