import { describe, it, expect } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createJsonStore } from "@/lib/store/json";
import { ensureSeed } from "@/lib/store/seed";
import type { MeasRow } from "@/lib/store/types";
import { mkProject } from "./helpers";

const fresh = () => createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-")));

describe("seed", () => {
  it("admin 계정과 기준·코드를 만들고, 두 번 실행해도 중복이 없다", async () => {
    const s = fresh();
    await ensureSeed(s, { samples: false });
    await ensureSeed(s, { samples: false });
    const users = await s.users.list();
    expect(users.map((u) => u.userId)).toEqual(["admin"]);
    expect(users[0]).toMatchObject({ role: "AX_ADMIN", orgCd: "SKAX", useYn: true });
    expect((await s.config.get("CRITERIA"))?.value).toBeTruthy();
    expect((await s.config.get("CODES"))?.value).toBeTruthy();
    expect(await s.config.keys("CRITERIA@")).toEqual(["CRITERIA@1"]);
  });

  it("샘플: 12개 과제와 데모 계정, PRJ-0001 은 선정", async () => {
    const s = fresh();
    await ensureSeed(s, { samples: true });
    const ps = await s.projects.list();
    expect(ps).toHaveLength(12);
    expect(ps.find((p) => p.prjId === "PRJ-0001")?.status).toBe("SELECTED");
    const ids = (await s.users.list()).map((u) => u.userId).sort();
    expect(ids).toEqual(["admin", "dev01", "dev02", "hx01", "pm01", "pm02", "qa01", "view01"]);
    const fits = new Set(ps.map((p) => p.suggestFit));
    expect(fits.has("H") && fits.has("M") && fits.has("L")).toBe(true);
  });
});

describe("users", () => {
  it("update 는 부분 갱신", async () => {
    const s = fresh();
    await ensureSeed(s, { samples: false });
    await s.users.update("admin", { userNm: "관리자2" });
    expect((await s.users.get("admin"))?.userNm).toBe("관리자2");
    expect((await s.users.get("admin"))?.role).toBe("AX_ADMIN");
  });

  it("없는 사용자는 null", async () => {
    expect(await fresh().users.get("nobody")).toBeNull();
  });
});

describe("projects", () => {
  it("updAt 이 다르면 false 이고 저장되지 않는다", async () => {
    const s = fresh();
    await s.projects.insert(mkProject({ prjNm: "원본" }));
    const ok = await s.projects.update(mkProject({ prjNm: "변경", updAt: "2026-10-02T00:00:00.000Z" }), "다른값");
    expect(ok).toBe(false);
    expect((await s.projects.get("PRJ-0001"))?.prjNm).toBe("원본");
  });

  it("updAt 이 같으면 저장", async () => {
    const s = fresh();
    const p = mkProject({ prjNm: "원본" });
    await s.projects.insert(p);
    const ok = await s.projects.update({ ...p, prjNm: "변경", updAt: "2026-10-02T00:00:00.000Z" }, p.updAt);
    expect(ok).toBe(true);
    expect((await s.projects.get("PRJ-0001"))?.prjNm).toBe("변경");
  });

  it("nextId 순번", async () => {
    const s = fresh();
    expect(await s.projects.nextId()).toBe("PRJ-0001");
    await s.projects.insert(mkProject({ prjId: "PRJ-0007" }));
    expect(await s.projects.nextId()).toBe("PRJ-0008");
  });

  it("동시 insert 10건이 유실되지 않는다", async () => {
    const s = fresh();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        s.projects.insert(mkProject({ prjId: `PRJ-${String(i + 1).padStart(4, "0")}` })),
      ),
    );
    expect(await s.projects.list()).toHaveLength(10);
  });

  it("같은 id 중복 insert 는 거부", async () => {
    const s = fresh();
    await s.projects.insert(mkProject());
    await expect(s.projects.insert(mkProject())).rejects.toThrow(/DUPLICATE/);
  });

  it("목록은 복사본이라 수정해도 저장본이 바뀌지 않는다", async () => {
    const s = fresh();
    await s.projects.insert(mkProject({ prjNm: "원본" }));
    (await s.projects.list())[0].prjNm = "x";
    expect((await s.projects.get("PRJ-0001"))?.prjNm).toBe("원본");
  });
});

describe("config", () => {
  it("set/get/keys", async () => {
    const s = fresh();
    await s.config.set("A@1", { x: 1 }, 1, "admin");
    await s.config.set("A@2", { x: 2 }, 2, "admin");
    await s.config.set("B", { y: 1 }, 1, "admin");
    expect((await s.config.get<{ x: number }>("A@2"))?.value.x).toBe(2);
    expect(await s.config.keys("A@")).toEqual(["A@1", "A@2"]);
    expect(await s.config.get("none")).toBeNull();
  });
});

describe("history", () => {
  it("최신순, limit, 필터", async () => {
    const s = fresh();
    for (let i = 0; i < 5; i++) {
      await s.history.add({
        targetTyp: "PROJECT",
        targetId: i % 2 ? "PRJ-0001" : "PRJ-0002",
        actionCd: "UPDATE",
        summary: `s${i}`,
        diff: null,
        userId: "admin",
        userNm: "관리자",
        regAt: `2026-10-0${i + 1}T00:00:00.000Z`,
      });
    }
    const all = await s.history.list({ limit: 3 });
    expect(all.map((h) => h.summary)).toEqual(["s4", "s3", "s2"]);
    expect(all[0].histId).toBe(5);
    expect((await s.history.list({ targetId: "PRJ-0001" })).map((h) => h.summary)).toEqual(["s3", "s1"]);
  });
});

describe("meas", () => {
  const row = (datId: string, data: unknown, prjId = "PRJ-0001"): MeasRow => ({
    datId,
    kind: "COMMIT",
    prjId,
    wbsId: "WBS-1",
    workDt: "2026-10-10",
    userId: "dev01",
    srcCd: "GIT",
    data,
    regUserId: "dev01",
    regAt: "2026-10-10T00:00:00.000Z",
    updAt: "2026-10-10T00:00:00.000Z",
  });

  it("같은 datId 두 번 upsert → 1행, 나중 값", async () => {
    const s = fresh();
    await s.meas.upsert([row("CMT:1", { a: 1 })]);
    await s.meas.upsert([row("CMT:1", { a: 2 })]);
    const rows = await s.meas.list("PRJ-0001");
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toEqual({ a: 2 });
  });

  it("과제·종류 필터, 삭제", async () => {
    const s = fresh();
    await s.meas.upsert([row("CMT:1", {}), row("CMT:2", {}, "PRJ-0002"), { ...row("FEAT:1", {}), kind: "FEATURE" }]);
    expect(await s.meas.list("PRJ-0001", "COMMIT")).toHaveLength(1);
    expect(await s.meas.listAll("COMMIT")).toHaveLength(2);
    await s.meas.remove("CMT:1");
    expect(await s.meas.list("PRJ-0001", "COMMIT")).toHaveLength(0);
  });
});
