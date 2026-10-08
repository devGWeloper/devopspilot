import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { verifyPassword } from "@/lib/auth/password";
import type { ActorFull } from "@/lib/auth/permissions";
import { createJsonStore } from "@/lib/store/json";
import { ensureSeed } from "@/lib/store/seed";
import type { Store } from "@/lib/store/types";
import { createUser, resetPassword, updateUser } from "@/lib/users/service";

const admin: ActorFull = { userId: "admin", role: "AX_ADMIN", userNm: "AX 관리자", orgCd: "SKAX" };
const pm: ActorFull = { userId: "pm01", role: "PM", userNm: "PM", orgCd: "SKAX" };

let store: Store;
beforeEach(async () => {
  store = createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-usr-")));
  await ensureSeed(store, { samples: false });
});

describe("users", () => {
  it("계정 생성 — 초기 비밀번호로 로그인 가능, 해시는 응답에 없음", async () => {
    const r = await createUser(store, admin, { userId: "hx02", userNm: "검토자", orgCd: "SKHYNIX", deptNm: "", role: "HX_REVIEWER", password: "init1234!" });
    expect(r.ok).toBe(true);
    expect(r.ok && "pwdHash" in r.value).toBe(false);
    const u = await store.users.get("hx02");
    expect(verifyPassword("init1234!", u!.pwdHash, u!.pwdSalt)).toBe(true);
  });

  it("중복 ID·잘못된 ID·짧은 비밀번호 거부", async () => {
    const base = { userNm: "x", orgCd: "SKAX" as const, deptNm: "", role: "PM" as const, password: "init1234!" };
    expect(await createUser(store, admin, { ...base, userId: "admin" })).toMatchObject({ ok: false, status: 409 });
    expect(await createUser(store, admin, { ...base, userId: "a b" })).toMatchObject({ ok: false, status: 422 });
    expect(await createUser(store, admin, { ...base, userId: "pm9", password: "123" })).toMatchObject({ ok: false, status: 422 });
  });

  it("관리자만", async () => {
    expect(await createUser(store, pm, { userId: "x1", userNm: "x", orgCd: "SKAX", deptNm: "", role: "PM", password: "init1234!" })).toMatchObject({ ok: false, status: 403 });
  });

  it("마지막 AX 관리자는 비활성화·강등할 수 없다", async () => {
    expect(await updateUser(store, admin, "admin", { role: "PM" })).toMatchObject({ ok: false, status: 409 });
    expect(await updateUser(store, admin, "admin", { useYn: false })).toMatchObject({ ok: false, status: 409 });
    await createUser(store, admin, { userId: "admin2", userNm: "관리자2", orgCd: "SKAX", deptNm: "", role: "AX_ADMIN", password: "init1234!" });
    expect((await updateUser(store, admin, "admin2", { useYn: false })).ok).toBe(true);
  });

  it("비밀번호 초기화는 새 임시 비밀번호를 돌려준다", async () => {
    const r = await resetPassword(store, admin, "admin");
    expect(r.ok).toBe(true);
    const u = await store.users.get("admin");
    expect(r.ok && verifyPassword(r.value.password, u!.pwdHash, u!.pwdSalt)).toBe(true);
    expect(r.ok && r.value.password.length).toBeGreaterThanOrEqual(10);
  });
});
