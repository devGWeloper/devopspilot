import { describe, it, expect } from "vitest";
import { addDays, isPostFix } from "@/lib/measure/postfix";
import { classifySize } from "@/lib/measure/size";

const bands = { S: 16, M: 40, L: 80 };

describe("classifySize", () => {
  it.each([
    [15.9, "S", false],
    [16, "M", false],
    [39.9, "M", false],
    [40, "L", false],
    [80, "L", false],
    [7, "S", true],
    [81, "L", true],
  ])("%sh → %s (범위 밖 %s)", (h, size, out) => {
    expect(classifySize(h as number, bands)).toEqual({ size, outOfRange: out });
  });
});

describe("isPostFix", () => {
  it("완료일 당일은 아니고, 다음 날부터 N일째까지", () => {
    expect(isPostFix("2026-10-10", "2026-10-10", 14)).toBe(false);
    expect(isPostFix("2026-10-11", "2026-10-10", 14)).toBe(true);
    expect(isPostFix("2026-10-24", "2026-10-10", 14)).toBe(true);
    expect(isPostFix("2026-10-25", "2026-10-10", 14)).toBe(false);
  });
  it("완료일 없으면 false", () => {
    expect(isPostFix("2026-10-11", null, 14)).toBe(false);
  });
  it("월 경계 addDays", () => {
    expect(addDays("2026-10-25", 14)).toBe("2026-11-08");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
