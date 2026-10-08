import { it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePasswordPolicy } from "@/lib/auth/password";

it("해시·검증 왕복", () => {
  const h = hashPassword("admin123!");
  expect(verifyPassword("admin123!", h.hash, h.salt)).toBe(true);
});

it("틀린 비밀번호는 false", () => {
  const h = hashPassword("admin123!");
  expect(verifyPassword("admin123", h.hash, h.salt)).toBe(false);
});

it("같은 비밀번호도 솔트가 달라 해시가 다르다", () => {
  expect(hashPassword("a1234567").hash).not.toBe(hashPassword("a1234567").hash);
});

it("깨진 해시는 false", () => {
  expect(verifyPassword("x", "", "")).toBe(false);
  expect(verifyPassword("x", "zz", "abcd")).toBe(false);
});

it("정책: 8자 이상", () => {
  expect(validatePasswordPolicy("short")).not.toBeNull();
  expect(validatePasswordPolicy("longenough")).toBeNull();
});
