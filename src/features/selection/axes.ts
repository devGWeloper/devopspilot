import { FORM_FIELDS, FORM_GROUPS, tally, type FormGroup } from "@/lib/projects/form";
import { STAGE_LABEL, STAGES, type StageCd } from "@/lib/types";
import type { SelReqVM, SelectionVM } from "@/lib/views";

export interface Axis {
  id: string;
  label: string;
  group: FormGroup;
  /** 과제 항목은 과제 수로 센다 — 요구사항 수로 세면 요구사항 많은 과제 하나가 분포를 끌고 간다. */
  level: "prj" | "req";
  options: string[];
  get: (r: SelReqVM) => string;
  check: boolean;
}

/** 필터 값 — 빈 칸만 골라 보기 */
export const BLANK = "__blank";

export const val = (r: SelReqVM, id: string) => (r.values[id] ?? "").trim();

// 한 분류에 절반 넘게 몰리면 그 분류의 효과가 전체 결론을 끌고 가므로 쏠림으로 본다.
export const SKEW = 0.5;
// 생산성 효과를 가를 만한 축만 균형을 본다 — 도구·요금제 같은 항목은 참고용 분포.
const CHECK = new Set(["PRJ-06", "PRJ-07", "PRJ-08", "REQ-03", "REQ-04", "REQ-05", "FIT-01", "FIT-02", "FIT-03", "FIT-06"]);
// '미정'·'기타' 같은 값은 비어 있어도 공백이 아니다.
const NEUTRAL = new Set(["미확인", "미정", "기타", "없음", "모름", "복합", "혼합"]);

// 행은 요구사항 × 단계 단위 — 단계(REQ-03)가 곧 SDLC 축이다.
export const AXES: Axis[] = FORM_FIELDS.filter((f) => f.kind === "select")
  .map(
    (f): Axis => ({
      id: f.id,
      label: f.label,
      group: f.group,
      level: f.group === "PRJ" ? "prj" : "req",
      options: f.options ?? [],
      get: (r) => val(r, f.id),
      check: CHECK.has(f.id),
    }),
  )
  .sort((a, b) => FORM_GROUPS.findIndex((g) => g.key === a.group) - FORM_GROUPS.findIndex((g) => g.key === b.group));


export const AXIS_BY_ID = Object.fromEntries(AXES.map((a) => [a.id, a])) as Record<string, Axis>;

export const getter = (id: string) => AXIS_BY_ID[id]?.get ?? ((r: SelReqVM) => val(r, id));

/** 과제 항목이면 과제마다 첫 요구사항 값 하나 */
export function unitVals(vm: SelectionVM, a: Axis): string[] {
  if (a.level === "req") return vm.reqs.map(a.get);
  return vm.projects.map((p) => {
    const r = vm.reqs.find((x) => x.prjId === p.prjId);
    return r ? a.get(r) : "";
  });
}

export interface AxisDist {
  rows: { v: string; n: number }[];
  total: number;
  blank: number;
  warns: string[];
}

export function distOf(vm: SelectionVM, a: Axis): AxisDist {
  const vals = unitVals(vm, a);
  const rows = tally(a.options, vals);
  const total = vals.length;
  const blank = vals.filter((v) => !v).length;
  const warns: string[] = [];
  if (a.check) {
    const filled = rows.filter((r) => r.n > 0);
    const meaningful = a.options.filter((o) => !NEUTRAL.has(o));
    if (!filled.length) warns.push("입력된 값 없음");
    else {
      const top = filled.reduce((x, r) => (r.n > x.n ? r : x));
      const share = top.n / (total - blank || 1);
      if (filled.length === 1 && a.options.length > 1) warns.push(`모두 '${top.v}'`);
      else if (share > SKEW) warns.push(`'${top.v}' 에 ${Math.round(share * 100)}% 쏠림`);
      // 선택지가 많은 축은 표본 수가 적으면 공백이 당연해서 짧은 축만 본다.
      const gaps = meaningful.filter((o) => !vals.includes(o));
      if (gaps.length && meaningful.length <= 5 && filled.length > 1) warns.push(`${gaps.join(", ")} 없음`);
    }
    if (blank) warns.push(`미입력 ${blank}`);
  }
  return { rows, total, blank, warns };
}

// 상·중·하 축은 점수로 바꿔 과제의 자리를 평균으로 잡는다 — 선정 과제 분포의 가로·세로 축.
const LEVEL: Record<string, number> = { 하: 1, 중: 2, 상: 3 };
export const LEVEL_AXES = AXES.filter((a) => a.level === "req" && a.options.join() === "상,중,하").map((a) => a.id);

/** 요구사항·단계 값의 평균(하 1 · 중 2 · 상 3). 상·중·하 값이 하나도 없으면 null */
export function levelAvg(reqs: SelReqVM[], id: string): number | null {
  const xs = reqs.map((r) => LEVEL[val(r, id)]).filter((x): x is number => x !== undefined);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export interface StageSum {
  cd: StageCd;
  label: string;
  n: number;
  baseMd: number;
}

/** SDLC 단계별 측정 단위 수·기준 공수 — 단위가 없는 단계도 자리를 지킨다 */
export function stageSums(reqs: SelReqVM[]): StageSum[] {
  return STAGES.map((cd) => {
    const rs = reqs.filter((r) => r.stage === cd);
    return { cd, label: STAGE_LABEL[cd], n: rs.length, baseMd: rs.reduce((a, r) => a + r.baseMd, 0) };
  });
}
