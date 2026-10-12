import { describe, it, expect } from "vitest";
import { defaultCriteria, defaultCodes } from "@/lib/criteria/defaults";
import { CODE_LISTS } from "@/lib/projects/fields";

describe("defaultCriteria", () => {
  const c = defaultCriteria();
  const inds = c.areas.flatMap((a) => a.indicators);

  it("양식 항목: Major 는 FIT-01~03, 나머지는 Minor", () => {
    expect(inds.filter((i) => i.tier === "MAJOR").map((i) => i.ref)).toEqual(["FIT-01", "FIT-02", "FIT-03"]);
    expect(inds.filter((i) => i.tier === "MINOR").map((i) => i.ref)).toEqual(["PRJ-09", "PRJ-10", "PRJ-11", "REF-02", "REF-03"]);
  });

  it("지표·선택지 id 유일, 모든 지표에 양식 ID", () => {
    const ids = inds.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of inds) {
      expect(i.ref).toBeTruthy();
      expect(new Set(i.options.map((o) => o.id)).size).toBe(i.options.length);
    }
  });

  it("버전 1, 규칙 = 가장 낮은 항목이 등급을 정함", () => {
    expect(c.version).toBe(1);
    expect(c.rule).toEqual({ lowMinMajorLow: 1, highMaxMajorLow: 0, highMinMajorHigh: "all" });
  });

  it("호출마다 새 객체", () => {
    const a = defaultCriteria();
    a.areas[0].name = "x";
    expect(defaultCriteria().areas[0].name).not.toBe("x");
  });

  it("금지 용어가 없다", () => {
    expect(JSON.stringify(c)).not.toMatch(/재수행|재작업/);
  });
});

describe("defaultCodes", () => {
  const k = defaultCodes();
  it("양식 코드값 시트의 목록이 모두 있다", () => {
    for (const l of CODE_LISTS) expect(k[l.key].length).toBeGreaterThan(0);
    expect(k.domains.map((x) => x.label)).toEqual(["MES", "MIS", "기타"]);
    expect(k.sysGrades.map((x) => x.label)).toEqual(["L0", "L1", "L2", "L3", "L4", "미확인"]);
    expect(k.sysTypes).toHaveLength(7);
    expect(k.workAreas.map((x) => x.label)).toEqual(["신규 구축", "기능 개선", "전환", "재구축 (차세대)", "혼합"]);
    expect(k.aiTools).toHaveLength(9);
    expect(k.target).toEqual({ total: 9, byFit: { H: 3, M: 3, L: 3 }, minPerDevType: 1, minLangKinds: 3 });
  });

  it("금지 용어가 없다", () => {
    expect(JSON.stringify(k)).not.toMatch(/재수행|재작업/);
  });
});
