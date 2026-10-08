import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEYLEN = 64;

export function hashPassword(plain: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  return { hash: scryptSync(plain, salt, KEYLEN).toString("hex"), salt };
}

export function verifyPassword(plain: string, hash: string, salt: string): boolean {
  if (!hash || !salt) return false;
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== KEYLEN) return false;
  return timingSafeEqual(expected, scryptSync(plain, salt, KEYLEN));
}

export function validatePasswordPolicy(plain: string): string | null {
  if (typeof plain !== "string" || plain.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
  if (plain.length > 200) return "비밀번호가 너무 깁니다.";
  return null;
}
