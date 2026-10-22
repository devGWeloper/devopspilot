import { describe, expect, it } from "vitest";
import { freeGaps, readTime } from "@/lib/measure/spans";

describe("readTime", () => {
  it("콜론 없이 적은 숫자도 시각으로 읽는다", () => {
    expect(["9", "09", "930", "0930", "9:30", "09:30", " 13:00 ", "1350", "0", "2350"].map((x) => readTime(x))).toEqual([
      "09:00",
      "09:00",
      "09:30",
      "09:30",
      "09:30",
      "09:30",
      "13:00",
      "13:50",
      "00:00",
      "23:50",
    ]);
  });

  it("10분 단위가 아니거나 시각이 아니면 null", () => {
    expect(["0915", "9:3", "24:00", "2460", "12:60", "", "abc", "12345", "9.30"].map((x) => readTime(x))).toEqual(Array(9).fill(null));
    expect(readTime("0915", 1)).toBe("09:15");
  });
});

describe("freeGaps", () => {
  it("잡힌 시간 사이의 빈 곳을 10분 단위 안쪽으로 자른다", () => {
    expect(freeGaps([{ start: "09:13", end: "10:00" }, { start: "11:00", end: "11:05" }], "09:00", "12:00")).toEqual([
      { start: "09:00", end: "09:10" },
      { start: "10:00", end: "11:00" },
      { start: "11:10", end: "12:00" },
    ]);
  });

  it("겹치거나 범위 밖으로 걸친 기록도 한 덩어리로 본다", () => {
    expect(
      freeGaps(
        [
          { start: "08:00", end: "09:30" },
          { start: "13:00", end: "14:00" },
          { start: "13:30", end: "15:00" },
          { start: "17:30", end: "20:00" },
        ],
        "09:00",
        "18:00",
      ),
    ).toEqual([
      { start: "09:30", end: "13:00" },
      { start: "15:00", end: "17:30" },
    ]);
  });

  it("10분보다 짧은 틈과 잘못된 구간은 버린다", () => {
    expect(freeGaps([{ start: "09:05", end: "09:00" }, { start: "09:00", end: "09:52" }, { start: "09:58", end: "10:00" }], "09:00", "10:00")).toEqual([]);
    expect(freeGaps([], "09:00", "10:00")).toEqual([{ start: "09:00", end: "10:00" }]);
  });
});
