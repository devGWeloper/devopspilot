// Edge 미들웨어와 Node 라우트가 함께 쓰므로 Web Crypto 와 TextEncoder 만 사용한다.
import { ROLES, type OrgCd, type Role } from "../types";

export const AUTH_COOKIE = "poc_session";
export const SESSION_TTL_SEC = 8 * 3600;
const DEV_SECRET = "poc-portal-dev-secret";

export interface SessionPayload {
  sub: string;
  name: string;
  role: Role;
  org: OrgCd;
  exp: number;
}

export function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  return s && s.trim() ? s.trim() : DEV_SECRET;
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // 사내망은 HTTP 로 운영되는 경우가 많아 기본은 off, HTTPS 면 환경변수로 켠다.
    secure: process.env.AUTH_COOKIE_SECURE === "true",
    path: "/",
    maxAge,
  };
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(
  p: Omit<SessionPayload, "exp">,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: SessionPayload = { ...p, exp: now + SESSION_TTL_SEC };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export type SessionReject = "NO_COOKIE" | "MALFORMED" | "BAD_SIGNATURE" | "EXPIRED" | "BAD_PAYLOAD" | "ERROR";

export type SessionCheck =
  | { session: SessionPayload; reason: null }
  | { session: null; reason: SessionReject; error?: string };

// 로그인 직후 로그인 화면으로 되돌아오면 쿠키 미전송·서명 불일치·런타임 오류가 겉으로 똑같아 보여, 사유를 구분해 둔다.
export async function inspectSession(
  token: string | undefined | null,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<SessionCheck> {
  if (!token) return { session: null, reason: "NO_COOKIE" };
  const parts = token.split(".");
  if (parts.length !== 2) return { session: null, reason: "MALFORMED" };
  const [body, sig] = parts;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), fromB64url(sig), enc.encode(body));
    if (!ok) return { session: null, reason: "BAD_SIGNATURE" };
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Partial<SessionPayload>;
    if (typeof p.sub !== "string" || !p.sub) return { session: null, reason: "BAD_PAYLOAD" };
    if (!ROLES.includes(p.role as Role)) return { session: null, reason: "BAD_PAYLOAD" };
    if (p.org !== "SKAX" && p.org !== "SKHYNIX") return { session: null, reason: "BAD_PAYLOAD" };
    if (typeof p.exp !== "number") return { session: null, reason: "BAD_PAYLOAD" };
    if (p.exp < now) return { session: null, reason: "EXPIRED" };
    const session = { sub: p.sub, name: typeof p.name === "string" ? p.name : "", role: p.role as Role, org: p.org, exp: p.exp };
    return { session, reason: null };
  } catch (e) {
    return { session: null, reason: "ERROR", error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

export async function verifySession(
  token: string | undefined | null,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<SessionPayload | null> {
  return (await inspectSession(token, secret, now)).session;
}
