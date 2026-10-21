import { it, expect } from "vitest";
import { f1, hm, hours, man, pct, won } from "@/lib/format";

it("pct: null 은 —, 반올림 정수, 음수", () => {
  expect(pct(null)).toBe("—");
  expect(pct(0.6)).toBe("60%");
  expect(pct(22 / 56)).toBe("39%");
  expect(pct(-0.125)).toBe("-13%");
  expect(pct(0.3333, 1)).toBe("33.3%");
});

it("hours: 소수 1자리, 정수는 그대로", () => {
  expect(hours(null)).toBe("—");
  expect(hours(70 / 3)).toBe("23.3h");
  expect(hours(16)).toBe("16h");
});

it("won: 천 단위 콤마, 큰 금액은 만원", () => {
  expect(won(null)).toBe("—");
  expect(won(1234.5)).toBe("1,235원");
  expect(won(12_345_678)).toBe("1,235만원");
  expect(won(-50_000)).toBe("-5만원");
});

it("f1: 소수 1자리 고정, man: 만 원 정수", () => {
  expect(f1(2)).toBe("2.0");
  expect(f1(1234.56)).toBe("1,234.6");
  expect(f1(null)).toBe("—");
  expect(man(12_345_678)).toBe("1,235");
});

it("hm: 분 단위 반올림, 0 시간·0 분은 생략", () => {
  expect(hm(null)).toBe("—");
  expect(hm(0)).toBe("0분");
  expect(hm(10 / 60)).toBe("10분");
  expect(hm(2)).toBe("2시간");
  expect(hm(1 + 10 / 60)).toBe("1시간 10분");
  expect(hm(0.1)).toBe("6분");
});
