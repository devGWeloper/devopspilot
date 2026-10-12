import { describe, expect, it } from "vitest";
import { defaultCriteria } from "@/lib/criteria/defaults";
import { ENTRY_STEPS } from "@/lib/projects/fields";
import { entryProgress, remarkRequired, stepOfField, toInput } from "@/lib/projects/validate";
import { filledBase, mkProject } from "./helpers";

const c = defaultCriteria();
const inds = c.areas.flatMap((a) => a.indicators);
const allAnswers = () => Object.fromEntries(inds.map((i) => [i.id, i.options[0].id]));

describe("entryProgress", () => {
  it("빈 과제는 다섯 단계 모두 남은 항목이 있다", () => {
    const r = entryProgress(toInput(mkProject({ prjNm: "x", sysNm: "" })), c);
    expect(r.missing).toHaveLength(ENTRY_STEPS.length);
    expect(r.done).toBe(false);
    expect(r.missing.every((n) => n > 0)).toBe(true);
    // 적합도 단계 = Major 3 + PM 판단·사유
    expect(r.missing[3]).toBe(5);
  });

  it("모두 채우면 완료, 완료율 100%", () => {
    const p = mkProject({ prjNm: "x", sysNm: "S", base: filledBase() });
    p.eval.answers = allAnswers();
    const r = entryProgress(toInput(p), c);
    expect(r).toMatchObject({ missing: [0, 0, 0, 0, 0], total: 0, done: true, rate: 1 });
  });

  it("완료율은 필수 항목 중 채운 비율", () => {
    const p = mkProject({ prjNm: "x", sysNm: "S", base: { ...filledBase(), staffNms: "" } });
    p.eval.answers = allAnswers();
    const r = entryProgress(toInput(p), c);
    expect(r.total).toBe(1);
    expect(r.rate).toBeCloseTo((r.required - 1) / r.required);
  });

  it("필드 → 단계 (지표는 영역이 놓인 단계)", () => {
    expect(stepOfField("sysGradeCd", c)).toBe(0);
    expect(stepOfField("answer.vcs", c)).toBe(0);
    expect(stepOfField("baseline.totalMm", c)).toBe(1);
    expect(stepOfField("aiToolCd", c)).toBe(2);
    expect(stepOfField("answer.spec", c)).toBe(3);
    expect(stepOfField("pmFitReason", c)).toBe(3);
    expect(stepOfField("answer.aiCert", c)).toBe(4);
    expect(stepOfField("remark", c)).toBe(4);
  });

  it("기타·복합·혼합을 고르면 비고가 필수", () => {
    const p = mkProject({ base: filledBase() });
    expect(remarkRequired(toInput(p))).toBe(false);
    expect(remarkRequired({ ...toInput(p), base: { ...p.base, sysTypeCd: "MIXED" } })).toBe(true);
    expect(remarkRequired({ ...toInput(p), answers: { vcs: "etc" } })).toBe(true);
  });
});
