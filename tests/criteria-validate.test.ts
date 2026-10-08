import { describe, it, expect } from "vitest";
import { defaultCriteria } from "@/lib/criteria/defaults";
import { impactOf, validateCriteria } from "@/lib/criteria/validate";
import { deriveColumns } from "@/lib/fitness";
import type { Criteria, Project } from "@/lib/types";
import { mkProject } from "./helpers";

describe("validateCriteria", () => {
  it("기본 기준은 유효", () => {
    expect(validateCriteria(defaultCriteria())).toEqual([]);
  });

  it("빈 영역 목록·빈 지표 이름·선택지 1개·Major 0개를 잡는다", () => {
    expect(validateCriteria({ ...defaultCriteria(), areas: [] })).toContain("영역이 1개 이상 있어야 합니다.");
    const c = defaultCriteria();
    c.areas[0].indicators[0].name = " ";
    c.areas[0].indicators[1].options = c.areas[0].indicators[1].options.slice(0, 1);
    const e = validateCriteria(c);
    expect(e.some((x) => x.includes("이름"))).toBe(true);
    expect(e.some((x) => x.includes("선택지"))).toBe(true);

    const noMajor = defaultCriteria();
    noMajor.areas.forEach((a) => a.indicators.forEach((i) => (i.tier = "MINOR")));
    expect(validateCriteria(noMajor)).toContain("Major 지표가 1개 이상 있어야 합니다.");
  });

  it("중복 id, 음수 규칙 값", () => {
    const c = defaultCriteria();
    c.areas[1].indicators[0].id = c.areas[0].indicators[0].id;
    c.rule.lowMinMajorLow = -1;
    const e = validateCriteria(c);
    expect(e.some((x) => x.includes("중복"))).toBe(true);
    expect(e.some((x) => x.includes("규칙"))).toBe(true);
  });

  it("빈 선택지 라벨", () => {
    const c = defaultCriteria();
    c.areas[0].indicators[0].options[0].label = "";
    expect(validateCriteria(c).some((x) => x.includes("선택지 이름"))).toBe(true);
  });
});

describe("impactOf", () => {
  const from = defaultCriteria();
  const allH = Object.fromEntries(from.areas.flatMap((a) => a.indicators).map((i) => [i.id, i.options.find((o) => o.level === "H")!.id]));
  const p = (id: string, answers: Record<string, string>): Project => {
    const base = mkProject({ prjId: id }).base;
    const ev = { answers, notes: {}, confirm: null };
    return mkProject({ prjId: id, prjNm: id, eval: ev, ...deriveColumns(from, { base, eval: ev }) });
  };

  it("규칙이 바뀌면 바뀌는 과제와 분포를 보여준다", () => {
    const oneLow = { ...allH, devType: "legacy" };
    const ps = [p("A", allH), p("B", oneLow)];
    const to: Criteria = { ...from, version: 2, rule: { ...from.rule, lowMinMajorLow: 1 } };
    const r = impactOf(ps, from, to);
    expect(r.from).toMatchObject({ H: 1, M: 1, L: 0 });
    expect(r.to).toMatchObject({ H: 1, M: 0, L: 1 });
    expect(r.changed).toEqual([{ prjId: "B", prjNm: "B", before: "M", after: "L" }]);
  });

  it("지표를 Minor 로 내리면 판정에서 빠진다", () => {
    const ps = [p("B", { ...allH, devType: "legacy" })];
    const to: Criteria = JSON.parse(JSON.stringify(from));
    to.areas[0].indicators[0].tier = "MINOR";
    expect(impactOf(ps, from, to).changed[0]).toMatchObject({ before: "M", after: "H" });
  });

  it("제외 과제는 계산하지 않는다", () => {
    const ps = [{ ...p("A", allH), status: "EXCLUDED" as const }];
    expect(impactOf(ps, from, from).from.H).toBe(0);
  });
});
