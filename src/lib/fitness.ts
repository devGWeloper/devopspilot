import {
  DEV_TYPE_INDICATOR,
  type Criteria,
  type Fit,
  type Level,
  type Project,
  type Tier,
} from "./types";

export const FIT_LABEL: Record<Fit, string> = { H: "상", M: "중", L: "하", NA: "미평가" };

export interface ProfileCell {
  indicatorId: string;
  indicatorName: string;
  areaId: string;
  tier: Tier;
  level: Level | null;
  optionLabel: string | null;
}

export interface FitEvaluation {
  profile: ProfileCell[];
  answerCnt: number;
  indicatorCnt: number;
  majorCount: Record<Level, number> & { total: number; answered: number };
  suggest: Fit;
  ruleText: string;
  minorLows: string[];
}

export function buildProfile(c: Criteria, answers: Record<string, string>): ProfileCell[] {
  const cells: ProfileCell[] = [];
  for (const area of c.areas) {
    for (const ind of area.indicators) {
      const opt = ind.options.find((o) => o.id === answers[ind.id]);
      cells.push({
        indicatorId: ind.id,
        indicatorName: ind.name,
        areaId: area.id,
        tier: ind.tier,
        level: opt ? opt.level : null,
        optionLabel: opt ? opt.label : null,
      });
    }
  }
  return cells;
}

function highThreshold(rule: Criteria["rule"], total: number): number {
  return rule.highMinMajorHigh === "half" ? Math.floor(total / 2) + 1 : rule.highMinMajorHigh;
}

export function evaluateFit(c: Criteria, answers: Record<string, string>): FitEvaluation {
  const profile = buildProfile(c, answers);
  const majors = profile.filter((p) => p.tier === "MAJOR");
  const count = { H: 0, M: 0, L: 0, total: majors.length, answered: 0 };
  for (const m of majors) {
    if (m.level) {
      count[m.level] += 1;
      count.answered += 1;
    }
  }
  const minorLows = profile.filter((p) => p.tier === "MINOR" && p.level === "L").map((p) => p.indicatorName);
  const answerCnt = profile.filter((p) => p.level !== null).length;

  let suggest: Fit;
  let ruleText: string;
  if (count.total === 0) {
    suggest = "NA";
    ruleText = "Major 지표가 없어 판정할 수 없음";
  } else if (count.answered < count.total) {
    suggest = "NA";
    ruleText = `Major ${count.total}개 중 ${count.total - count.answered}개 미응답 → 미평가`;
  } else {
    if (count.L >= c.rule.lowMinMajorLow) suggest = "L";
    else if (count.L <= c.rule.highMaxMajorLow && count.H >= highThreshold(c.rule, count.total)) suggest = "H";
    else suggest = "M";
    ruleText = `Major ${count.total}개 중 하 ${count.L}개, 상 ${count.H}개 → ${FIT_LABEL[suggest]}`;
  }

  return { profile, answerCnt, indicatorCnt: profile.length, majorCount: count, suggest, ruleText, minorLows };
}

export function reconcileAnswers(
  c: Criteria,
  answers: Record<string, string>,
  notes: Record<string, string>,
): { answers: Record<string, string>; notes: Record<string, string> } {
  const outA: Record<string, string> = {};
  const outN: Record<string, string> = {};
  for (const area of c.areas) {
    for (const ind of area.indicators) {
      const a = answers[ind.id];
      if (a !== undefined && ind.options.some((o) => o.id === a)) outA[ind.id] = a;
      if (notes[ind.id] !== undefined) outN[ind.id] = notes[ind.id];
    }
  }
  return { answers: outA, notes: outN };
}

export function deriveColumns(
  c: Criteria,
  p: Pick<Project, "base" | "eval">,
): Pick<
  Project,
  | "devTypeCd"
  | "mainLangCd"
  | "domainCd"
  | "sysTypeCd"
  | "answerCnt"
  | "indicatorCnt"
  | "suggestFit"
  | "finalFit"
  | "critVer"
> {
  const ev = evaluateFit(c, p.eval.answers);
  return {
    devTypeCd: p.eval.answers[DEV_TYPE_INDICATOR] ?? null,
    mainLangCd: p.base.langCds[0] ?? null,
    domainCd: p.base.domainCd || null,
    sysTypeCd: p.base.sysTypeCd || null,
    answerCnt: ev.answerCnt,
    indicatorCnt: ev.indicatorCnt,
    suggestFit: ev.suggest,
    finalFit: p.eval.confirm?.fit ?? "NA",
    critVer: c.version,
  };
}
