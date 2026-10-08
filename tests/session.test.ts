import { describe, it, expect } from "vitest";
import { signSession, verifySession, SESSION_TTL_SEC } from "@/lib/auth/session";
import { checkLock, recordFailure, recordSuccess, LOCK_MAX_FAILS } from "@/lib/auth/loginLimiter";

const P = { sub: "admin", name: "관리자", role: "AX_ADMIN" as const, org: "SKAX" as const };
const NOW = 1_800_000_000;

describe("session", () => {
  it("서명·검증 왕복", async () => {
    const t = await signSession(P, "secret", NOW);
    expect(await verifySession(t, "secret", NOW + 10)).toMatchObject({ ...P, exp: NOW + SESSION_TTL_SEC });
  });

  it("한글 이름도 왕복", async () => {
    const t = await signSession({ ...P, name: "김지훈" }, "secret", NOW);
    expect((await verifySession(t, "secret", NOW))?.name).toBe("김지훈");
  });

  it("본문을 바꾸면 null", async () => {
    const t = await signSession(P, "secret", NOW);
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...P, role: "AX_ADMIN", sub: "x", exp: NOW + 999 })).toString("base64url");
    expect(await verifySession(`${forged}.${sig}`, "secret", NOW)).toBeNull();
    expect(body).not.toBe(forged);
  });

  it("다른 키는 null", async () => {
    expect(await verifySession(await signSession(P, "a", NOW), "b", NOW)).toBeNull();
  });

  it("만료되면 null", async () => {
    const t = await signSession(P, "secret", NOW);
    expect(await verifySession(t, "secret", NOW + SESSION_TTL_SEC + 1)).toBeNull();
  });

  it("역할 값이 이상하면 null", async () => {
    const t = await signSession({ ...P, role: "ROOT" as never }, "secret", NOW);
    expect(await verifySession(t, "secret", NOW)).toBeNull();
  });

  it("형식이 깨진 토큰은 null", async () => {
    expect(await verifySession(undefined, "secret", NOW)).toBeNull();
    expect(await verifySession("abc", "secret", NOW)).toBeNull();
    expect(await verifySession("a.b.c", "secret", NOW)).toBeNull();
  });
});

describe("loginLimiter", () => {
  it(`${LOCK_MAX_FAILS}회 실패 후 잠기고 10분 뒤 풀린다`, () => {
    const t0 = 1_000_000;
    for (let i = 0; i < LOCK_MAX_FAILS - 1; i++) recordFailure("u-lock", t0);
    expect(checkLock("u-lock", t0).locked).toBe(false);
    recordFailure("u-lock", t0);
    expect(checkLock("u-lock", t0 + 1000)).toMatchObject({ locked: true });
    expect(checkLock("u-lock", t0 + 10 * 60 * 1000 + 1).locked).toBe(false);
  });

  it("성공하면 실패 횟수 초기화", () => {
    const t0 = 2_000_000;
    for (let i = 0; i < LOCK_MAX_FAILS - 1; i++) recordFailure("u-ok", t0);
    recordSuccess("u-ok");
    recordFailure("u-ok", t0);
    expect(checkLock("u-ok", t0).locked).toBe(false);
  });

  it("오래된 실패는 세지 않는다", () => {
    const t0 = 3_000_000;
    for (let i = 0; i < LOCK_MAX_FAILS - 1; i++) recordFailure("u-old", t0);
    recordFailure("u-old", t0 + 11 * 60 * 1000);
    expect(checkLock("u-old", t0 + 11 * 60 * 1000).locked).toBe(false);
  });
});
