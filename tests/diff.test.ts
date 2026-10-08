import { it, expect } from "vitest";
import { shallowDiff } from "@/lib/diff";

it("바뀐 키만, 전/후 값과 함께", () => {
  expect(shallowDiff({ a: 1, b: "x", c: [1] }, { a: 1, b: "y", c: [1, 2], d: true })).toEqual([
    { key: "b", before: "x", after: "y" },
    { key: "c", before: [1], after: [1, 2] },
    { key: "d", before: undefined, after: true },
  ]);
});

it("중첩 객체는 내용이 같으면 변경 아님", () => {
  expect(shallowDiff({ o: { x: 1 } }, { o: { x: 1 } })).toEqual([]);
});

it("사라진 키도 변경", () => {
  expect(shallowDiff({ a: 1 }, {})).toEqual([{ key: "a", before: 1, after: undefined }]);
});
