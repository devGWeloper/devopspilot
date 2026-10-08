import { describe, it, expect } from "vitest";
import { defaultCriteria, defaultCodes } from "@/lib/criteria/defaults";
import { DEV_TYPE_INDICATOR, EXEC_TYPE_INDICATOR } from "@/lib/types";

describe("defaultCriteria", () => {
  const c = defaultCriteria();
  const inds = c.areas.flatMap((a) => a.indicators);

  it("4개 영역 17개 지표", () => {
    expect(c.areas).toHaveLength(4);
    expect(inds).toHaveLength(17);
  });

  it("Major 8개", () => {
    expect(inds.filter((i) => i.tier === "MAJOR")).toHaveLength(8);
  });

  it("지표·선택지 id 유일", () => {
    const ids = inds.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of inds) expect(new Set(i.options.map((o) => o.id)).size).toBe(i.options.length);
  });

  it("분류용 지표 존재", () => {
    expect(inds.some((i) => i.id === DEV_TYPE_INDICATOR)).toBe(true);
    expect(inds.some((i) => i.id === EXEC_TYPE_INDICATOR)).toBe(true);
  });

  it("버전 1, 규칙 기본값", () => {
    expect(c.version).toBe(1);
    expect(c.rule).toEqual({ lowMinMajorLow: 2, highMaxMajorLow: 0, highMinMajorHigh: "half" });
  });

  it("호출마다 새 객체", () => {
    const a = defaultCriteria();
    a.areas[0].name = "x";
    expect(defaultCriteria().areas[0].name).not.toBe("x");
  });
});

describe("defaultCodes", () => {
  it("코드·목표 기본값", () => {
    const k = defaultCodes();
    expect(k.langs.length).toBeGreaterThanOrEqual(7);
    expect(k.domains.length).toBeGreaterThanOrEqual(7);
    expect(k.sysTypes.length).toBeGreaterThanOrEqual(6);
    expect(k.target).toEqual({ total: 9, byFit: { H: 3, M: 3, L: 3 }, minPerDevType: 1, minLangKinds: 3 });
  });
});
