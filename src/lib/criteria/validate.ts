import { evaluateFit, reconcileAnswers } from "../fitness";
import type { Criteria, Fit, Project } from "../types";

export function validateCriteria(c: Criteria): string[] {
  const e: string[] = [];
  if (!c.areas?.length) {
    e.push("영역이 1개 이상 있어야 합니다.");
    return e;
  }
  const ids = new Set<string>();
  let majors = 0;
  for (const a of c.areas) {
    if (!a.name?.trim()) e.push("이름이 없는 영역이 있습니다.");
    if (!a.indicators?.length) e.push(`영역 '${a.name}'에 지표가 없습니다.`);
    for (const i of a.indicators ?? []) {
      const nm = i.name?.trim() || "(이름 없음)";
      if (!i.name?.trim()) e.push(`영역 '${a.name}'에 이름이 없는 지표가 있습니다.`);
      if (ids.has(i.id)) e.push(`지표 id '${i.id}' 가 중복됩니다.`);
      ids.add(i.id);
      if (i.tier === "MAJOR") majors++;
      if ((i.options ?? []).length < 2) e.push(`지표 '${nm}'의 선택지는 2개 이상이어야 합니다.`);
      if ((i.options ?? []).some((o) => !o.label?.trim())) e.push(`지표 '${nm}'에 선택지 이름이 비어 있습니다.`);
      const oids = (i.options ?? []).map((o) => o.id);
      if (new Set(oids).size !== oids.length) e.push(`지표 '${nm}'의 선택지 id 가 중복됩니다.`);
      if ((i.options ?? []).some((o) => !["H", "M", "L"].includes(o.level))) e.push(`지표 '${nm}'의 선택지 수준이 올바르지 않습니다.`);
    }
  }
  if (majors === 0) e.push("Major 지표가 1개 이상 있어야 합니다.");
  const r = c.rule;
  const okInt = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0;
  if (!okInt(r.lowMinMajorLow) || !okInt(r.highMaxMajorLow) || !(r.highMinMajorHigh === "half" || okInt(r.highMinMajorHigh))) {
    e.push("판정 규칙 값은 0 이상의 정수여야 합니다.");
  }
  if (okInt(r.lowMinMajorLow) && okInt(r.highMaxMajorLow) && r.highMaxMajorLow >= r.lowMinMajorLow) {
    e.push("판정 규칙: '상' 허용 하 개수는 '하' 기준 개수보다 작아야 합니다.");
  }
  return e;
}

export interface Impact {
  from: Record<Fit, number>;
  to: Record<Fit, number>;
  changed: { prjId: string; prjNm: string; before: Fit; after: Fit }[];
}

// 게시 전에 "이 기준으로 바꾸면 제안 적합도가 어떻게 달라지나"를 보여 준다. 확정값은 기준과 무관하므로 제안값만 비교한다.
export function impactOf(projects: Project[], from: Criteria, to: Criteria): Impact {
  const zero = (): Record<Fit, number> => ({ H: 0, M: 0, L: 0, NA: 0 });
  const r: Impact = { from: zero(), to: zero(), changed: [] };
  for (const p of projects) {
    if (p.status === "EXCLUDED") continue;
    const before = evaluateFit(from, p.eval.answers).suggest;
    const { answers } = reconcileAnswers(to, p.eval.answers, {});
    const after = evaluateFit(to, answers).suggest;
    r.from[before]++;
    r.to[after]++;
    if (before !== after) r.changed.push({ prjId: p.prjId, prjNm: p.prjNm, before, after });
  }
  return r;
}
