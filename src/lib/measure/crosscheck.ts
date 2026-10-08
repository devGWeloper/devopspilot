import { aiCostOf } from "./metrics";
import { addDays, daysBetween, isPostFix } from "./postfix";
import type { MeasureInput } from "./types";

export interface CrossIssue {
  prjId: string;
  wbsId: string;
  featureName: string;
  kind: "COMMIT_OUTSIDE" | "AI_OUTSIDE" | "NO_TRACE";
  detail: string;
  dates: string[];
}

export interface IdleIssue {
  prjId: string;
  wbsId: string;
  featureName: string;
  devUserNm: string | null;
  lastWorkDt: string | null;
  idleDays: number | null;
}

export interface CheckReport {
  cross: CrossIssue[];
  idle: IdleIssue[];
  commitViolation: { total: number; violations: number; rate: number | null };
  unknownWbsUsage: number;
  unpricedModels: string[];
}

export function runChecks(input: MeasureInput, today: string): CheckReport {
  const st = input.settings;
  const tol = st.crossCheckToleranceDays;
  const cross: CrossIssue[] = [];
  const idle: IdleIssue[] = [];

  for (const f of input.features) {
    const same = <T extends { prjId: string; wbsId: string | null }>(x: T) => x.prjId === f.prjId && x.wbsId === f.wbsId;
    const dates = input.efforts.filter(same).map((e) => e.workDt).sort();
    const commits = input.commits.filter(same);
    const usages = input.usages.filter(same);

    if (dates.length) {
      const lo = addDays(dates[0], -tol);
      const hi = addDays(dates[dates.length - 1], tol);
      const outside = (d: string) => d < lo || d > hi;
      // 완료 후 판정 기간 안의 커밋은 사후 수정으로 따로 세므로 교차 검증 위반이 아니다.
      const badCommits = commits.filter((c) => outside(c.workDt) && !isPostFix(c.workDt, f.completedAt, st.postFixDays)).map((c) => c.workDt);
      const badAi = usages.filter((u) => outside(u.workDt)).map((u) => u.workDt);
      const range = `공수 기록 ${dates[0]} ~ ${dates[dates.length - 1]} (허용 ±${tol}일)`;
      if (badCommits.length) cross.push({ prjId: f.prjId, wbsId: f.wbsId, featureName: f.name, kind: "COMMIT_OUTSIDE", detail: range, dates: Array.from(new Set(badCommits)).sort() });
      if (badAi.length) cross.push({ prjId: f.prjId, wbsId: f.wbsId, featureName: f.name, kind: "AI_OUTSIDE", detail: range, dates: Array.from(new Set(badAi)).sort() });
      if (!commits.length && !usages.length) cross.push({ prjId: f.prjId, wbsId: f.wbsId, featureName: f.name, kind: "NO_TRACE", detail: `공수 ${dates.length}일 기록, 커밋·AI 기록 없음`, dates: [] });
    }

    if (f.status === "DOING") {
      const last = dates[dates.length - 1] ?? null;
      const gap = last ? daysBetween(last, today) : null;
      if (gap === null || gap >= st.idleAlertDays) {
        idle.push({ prjId: f.prjId, wbsId: f.wbsId, featureName: f.name, devUserNm: f.devUserNm, lastWorkDt: last, idleDays: gap });
      }
    }
  }

  const known = new Set(input.features.map((f) => `${f.prjId}|${f.wbsId}`));
  const violations = input.commits.filter((c) => !c.wbsId).length;
  return {
    cross,
    idle,
    commitViolation: { total: input.commits.length, violations, rate: input.commits.length ? violations / input.commits.length : null },
    unknownWbsUsage: input.usages.filter((u) => !u.wbsId || !known.has(`${u.prjId}|${u.wbsId}`)).length,
    unpricedModels: Array.from(new Set(input.usages.filter((u) => aiCostOf(u, st.tokenPrices) === null).map((u) => u.model))),
  };
}
