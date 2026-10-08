import { FIT_LABEL } from "./fitness";
import {
  DEV_TYPE_INDICATOR,
  LEVELS,
  type Codes,
  type Criteria,
  type Fit,
  type Project,
  type ProjectStatus,
} from "./types";

export interface BalanceWarning {
  kind: "TOTAL" | "FIT" | "DEV_TYPE" | "LANG";
  message: string;
}

export interface BalanceReport {
  selectedCount: number;
  byFit: Record<Fit, number>;
  byDevType: Record<string, number>;
  byLang: Record<string, number>;
  byDomain: Record<string, number>;
  bySysType: Record<string, number>;
  warnings: BalanceWarning[];
}

export function effectiveFit(p: Pick<Project, "finalFit" | "suggestFit">): Fit {
  return p.finalFit !== "NA" ? p.finalFit : p.suggestFit;
}

function inc(m: Record<string, number>, k: string | null) {
  if (!k) return;
  m[k] = (m[k] ?? 0) + 1;
}

export function analyzeBalance(
  projects: Project[],
  c: Criteria,
  codes: Codes,
  statuses: ProjectStatus[] = ["SELECTED"],
): BalanceReport {
  const picked = projects.filter((p) => statuses.includes(p.status));
  const byFit: Record<Fit, number> = { H: 0, M: 0, L: 0, NA: 0 };
  const byDevType: Record<string, number> = {};
  const byLang: Record<string, number> = {};
  const byDomain: Record<string, number> = {};
  const bySysType: Record<string, number> = {};
  for (const p of picked) {
    byFit[effectiveFit(p)] += 1;
    inc(byDevType, p.devTypeCd);
    inc(byLang, p.mainLangCd);
    inc(byDomain, p.domainCd);
    inc(bySysType, p.sysTypeCd);
  }

  const t = codes.target;
  const warnings: BalanceWarning[] = [];
  if (picked.length < t.total) {
    warnings.push({ kind: "TOTAL", message: `선정 ${picked.length}건 (목표 ${t.total}건)` });
  }
  for (const lv of LEVELS) {
    if (byFit[lv] < t.byFit[lv]) {
      warnings.push({ kind: "FIT", message: `${FIT_LABEL[lv]} 적합도 목표 ${t.byFit[lv]}건 중 ${byFit[lv]}건` });
    }
  }
  const devInd = c.areas.flatMap((a) => a.indicators).find((i) => i.id === DEV_TYPE_INDICATOR);
  if (devInd && t.minPerDevType > 0) {
    for (const o of devInd.options) {
      const n = byDevType[o.id] ?? 0;
      if (n < t.minPerDevType) warnings.push({ kind: "DEV_TYPE", message: `개발 성격 '${o.label}' 선정 ${n}건` });
    }
  }
  const langKinds = Object.keys(byLang).length;
  if (langKinds < t.minLangKinds) {
    warnings.push({ kind: "LANG", message: `언어 ${langKinds}종 (목표 ${t.minLangKinds}종 이상)` });
  }

  return { selectedCount: picked.length, byFit, byDevType, byLang, byDomain, bySysType, warnings };
}
