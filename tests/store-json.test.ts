import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createJsonStore } from "@/lib/store/json";
import { ensureSeed } from "@/lib/store/seed";
import type { MeasRow } from "@/lib/store/types";
import { rowsOf } from "@/lib/measure/metrics";
import { loadIndex } from "@/lib/measure/service";
import { mkProject } from "./helpers";

const fresh = () => createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-")));

describe("seed", () => {
  it("admin 계정과 설정을 만들고, 두 번 실행해도 중복이 없다", async () => {
    const s = fresh();
    await ensureSeed(s, { samples: false });
    await ensureSeed(s, { samples: false });
    const users = await s.users.list();
    expect(users.map((u) => u.userId)).toEqual(["admin"]);
    expect(users[0]).toMatchObject({ role: "ADMIN", useYn: true });
    expect((await s.config.get("SETTINGS"))?.value).toBeTruthy();
  });

  it("샘플: 과제 10개·데모 계정, 확정 스냅샷이 실제 값과 같다", async () => {
    const s = fresh();
    await ensureSeed(s, { samples: true });
    expect(await s.projects.list()).toHaveLength(10);
    const ids = (await s.users.list()).map((u) => u.userId).sort();
    expect(ids).toEqual(["admin", "dev01", "dev02", "dev03", "dev04", "dev05", "dev06", "view01"]);
    const ix = await loadIndex(s);
    const req = ix.data.projects.flatMap((p) => p.reqs).find((r) => r.reqId === "REQ0033")!;
    // 샘플 확정일이 '값 변경 · 재확정 필요'로 보이면 시연이 깨진다.
    expect(rowsOf(ix, "dev02", req).every((r) => r.st === "conf")).toBe(true);
  });
});

describe("users", () => {
  it("update 는 부분 갱신", async () => {
    const s = fresh();
    await ensureSeed(s, { samples: false });
    await s.users.update("admin", { userNm: "관리자2" });
    expect((await s.users.get("admin"))?.userNm).toBe("관리자2");
    expect((await s.users.get("admin"))?.role).toBe("ADMIN");
  });

  it("없는 사용자는 null", async () => {
    expect(await fresh().users.get("nobody")).toBeNull();
  });

  it("10/15 이전 역할 코드로 저장된 계정도 현재 역할로 읽힌다", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "poc-"));
    const old = (userId: string, role: string) => ({ userId, userNm: userId, orgCd: "SKAX", role, useYn: true, pwdHash: "h", pwdSalt: "s" });
    writeFileSync(
      path.join(dir, "users.json"),
      JSON.stringify([old("admin", "AX_ADMIN"), old("hx01", "HX_REVIEWER"), old("pm01", "PM"), old("qa01", "TESTER"), old("dev01", "DEVELOPER")]),
    );
    const s = createJsonStore(dir);
    expect((await s.users.get("admin"))?.role).toBe("ADMIN");
    expect(Object.fromEntries((await s.users.list()).map((u) => [u.userId, u.role]))).toEqual({
      admin: "ADMIN",
      hx01: "VIEWER",
      pm01: "VIEWER",
      qa01: "DEVELOPER",
      dev01: "DEVELOPER",
    });
  });
});

describe("projects", () => {
  it("updAt 이 다르면 false 이고 저장되지 않는다", async () => {
    const s = fresh();
    await s.projects.insert(mkProject({ prjNm: "원본" }));
    const ok = await s.projects.update(mkProject({ prjNm: "변경", updAt: "2026-10-02T00:00:00.000Z" }), "다른값");
    expect(ok).toBe(false);
    expect((await s.projects.get("DAE01"))?.prjNm).toBe("원본");
  });

  it("updAt 이 같으면 저장", async () => {
    const s = fresh();
    const p = mkProject({ prjNm: "원본" });
    await s.projects.insert(p);
    const ok = await s.projects.update({ ...p, prjNm: "변경", updAt: "2026-10-02T00:00:00.000Z" }, p.updAt);
    expect(ok).toBe(true);
    expect((await s.projects.get("DAE01"))?.prjNm).toBe("변경");
  });

  it("이전 형식 과제(요구사항 단위 등급·완료)는 태그로 내려 채워 읽는다", async () => {
    const s = fresh();
    const old = { ...mkProject(), reqs: [{ reqId: "R1", name: "", grade: "고급", difficulty: "상", baseSrc: "", done: true, doneAt: "2026-11-01", extra: {}, stages: [{ cd: "DV", workType: "", ownerId: null, ownerNm: "", baseMd: 1 }] }] };
    await s.projects.insert(old as never);
    const st = (await s.projects.get(old.prjId))!.reqs[0].stages[0];
    expect(st).toMatchObject({ grade: "고급", difficulty: "상", done: true, doneAt: "2026-11-01", fit: "" });
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
    expect((await s.projects.get("DAE01"))?.prjNm).toBe("원본");
  });
});

describe("config", () => {
  it("set/get", async () => {
    const s = fresh();
    await s.config.set("A", { x: 1 }, 1, "admin");
    await s.config.set("A", { x: 2 }, 2, "admin");
    expect((await s.config.get<{ x: number }>("A"))?.value.x).toBe(2);
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
  const row = (datId: string, data: unknown, kind: MeasRow["kind"] = "EFFORT"): MeasRow => ({
    datId,
    kind,
    prjId: "PRJ-0001",
    reqId: "REQ-0001",
    workDt: "2026-10-10",
    userId: "dev01",
    srcCd: "MANUAL",
    data,
    regUserId: "dev01",
    regAt: "2026-10-10T00:00:00.000Z",
    updAt: "2026-10-10T00:00:00.000Z",
  });

  it("같은 datId 두 번 upsert → 1행, 나중 값", async () => {
    const s = fresh();
    await s.meas.upsert([row("E|1", { a: 1 })]);
    await s.meas.upsert([row("E|1", { a: 2 })]);
    const rows = await s.meas.listAll();
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toEqual({ a: 2 });
    expect((await s.meas.get("E|1"))?.data).toEqual({ a: 2 });
  });

  it("종류 필터, 삭제", async () => {
    const s = fresh();
    await s.meas.upsert([row("E|1", {}), row("C|1", {}, "CONF"), row("A|1", {}, "AIUSE")]);
    expect(await s.meas.listAll("CONF")).toHaveLength(1);
    await s.meas.remove("E|1");
    expect(await s.meas.listAll("EFFORT")).toHaveLength(0);
  });

  it("다른 저장소 객체로 다시 열어도 같은 값 (메모리 사본이 파일과 어긋나지 않음)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "poc-"));
    await createJsonStore(dir).meas.upsert([row("E|1", { a: 1 })]);
    expect((await createJsonStore(dir).meas.get("E|1"))?.data).toEqual({ a: 1 });
  });
});

describe("seed 샘플 — 다음 날 확정률·AI 비용 시연", () => {
  it("데모 계정에 AI 도구 계정이 있고, 확정 시각이 미래가 아니다", async () => {
    const s = fresh();
    await ensureSeed(s, { samples: true });
    expect((await s.users.get("dev01"))?.aiAcct).toBe("dev01@skax.demo");
    const now = new Date().toISOString();
    expect((await loadIndex(s)).data.confs.every((c) => !c.confirmedAt || c.confirmedAt <= now)).toBe(true);
  });
});
