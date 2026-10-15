import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { kstDate } from "@/lib/measure/ingest";
import { rowsOf } from "@/lib/measure/metrics";
import { confirmDays, ingestOtel, loadIndex, reopenDay, resolveSession, saveEffort, todayKst, uploadLog } from "@/lib/measure/service";
import { createJsonStore } from "@/lib/store/json";
import { ensureSeed } from "@/lib/store/seed";
import type { Store } from "@/lib/store/types";
import type { UserRecord } from "@/lib/types";
import { admin, dev1, dev2, mkProject, mkReq, mkStage } from "../helpers";

// 오늘 이후 날짜는 서비스가 거부하므로 실행일 기준 과거로 잡는다.
const D = kstDate(Date.now() - 3 * 86400000);
let store: Store;

const user = (userId: string, userNm: string): UserRecord => ({
  userId,
  userNm,
  orgCd: "SKAX",
  deptNm: "",
  role: "DEVELOPER",
  useYn: true,
  pwdHash: "x",
  pwdSalt: "x",
  lastLoginAt: null,
  regAt: "",
  updAt: "",
});

beforeEach(async () => {
  store = createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-svc-")));
  await ensureSeed(store, { samples: false });
  await store.users.insert(user("dev01", "김개발"));
  await store.users.insert(user("dev02", "박개발"));
  await store.projects.insert(
    mkProject({
      reqs: [
        mkReq({ reqId: "R-1", stages: [mkStage({ cd: "DS", ownerId: "dev01" }), mkStage({ cd: "DV", ownerId: "dev01" })] }),
        mkReq({ reqId: "R-2", stages: [mkStage({ cd: "DV", ownerId: "dev02" })] }),
      ],
    }),
  );
});

const req1 = async () => (await loadIndex(store)).data.projects[0].reqs[0];

describe("공수 입력·확정", () => {
  it("담당 개발자만, 오늘 이후·A8 메모 없음은 거부", async () => {
    expect((await saveEffort(store, dev1, { unit: "R-1-DV", date: D, add: { A1: 2 } })).ok).toBe(true);
    expect(await saveEffort(store, dev2, { unit: "R-1-DV", date: D, add: { A1: 2 } })).toMatchObject({ ok: false, status: 403 });
    expect(await saveEffort(store, admin, { unit: "R-1-DV", date: D, add: { A1: 2 } })).toMatchObject({ ok: false, status: 403 });
    expect(await saveEffort(store, dev1, { unit: "R-1-DV", date: "2999-01-01", add: { A1: 1 } })).toMatchObject({ ok: false, code: "BAD_DATE" });
    expect(await saveEffort(store, dev1, { unit: "R-1-DV", date: D, add: { A8: 1 } })).toMatchObject({ ok: false, code: "MEMO_REQUIRED" });
  });

  it("AI 도구 내 시간은 수집값보다 크게 못 넣는다", async () => {
    await ingestOtel(store, [{ userId: "dev01", sessionId: "s", tool: "Claude Code", workDt: D, ms: Date.parse(D), minutes: 120, hints: ["R-1-DV"], branch: "" }]);
    expect(await saveEffort(store, dev1, { unit: "R-1-DV", date: D, inT: 3 })).toMatchObject({ ok: false, code: "OVER_COLLECTED" });
    expect((await saveEffort(store, dev1, { unit: "R-1-DV", date: D, inT: 1.5 })).ok).toBe(true);
    const ix = await loadIndex(store);
    expect(ix.effort.get(`R-1-DV|${D}`)?.reduceH).toBe(0.5);
  });

  it("확정 → 확정된 날은 못 고침 → 수정(해제) → 재확정 시 수정 횟수", async () => {
    await saveEffort(store, dev1, { unit: "R-1-DV", date: D, add: { A1: 2 } });
    expect(await confirmDays(store, dev1, "R-1")).toMatchObject({ ok: true, value: { count: 1 } });
    expect(await saveEffort(store, dev1, { unit: "R-1-DV", date: D, add: { A1: 3 } })).toMatchObject({ ok: false, code: "CONFIRMED" });
    expect((await reopenDay(store, dev1, "R-1", D)).ok).toBe(true);
    expect((await saveEffort(store, dev1, { unit: "R-1-DV", date: D, add: { A1: 3 } })).ok).toBe(true);
    await confirmDays(store, dev1, "R-1", [D]);
    const rows = rowsOf(await loadIndex(store), "dev01", await req1());
    expect(rows[0]).toMatchObject({ st: "conf", revCount: 1 });
    expect((await store.history.list({ targetTyp: "EFFORT" })).length).toBeGreaterThan(0);
  });
});

describe("AI 사용 배정", () => {
  beforeEach(async () => {
    await ingestOtel(store, [{ userId: "dev01", sessionId: "s9", tool: "Claude Code", workDt: D, ms: Date.parse(D), minutes: 60, hints: ["R-1"], branch: "" }]);
  });

  it("단계가 둘이면 확인 필요 → 나눠 배정하면 사라진다", async () => {
    let ix = await loadIndex(store);
    expect(ix.alloc.pending).toHaveLength(1);
    const id = ix.alloc.pending[0].session.datId;
    expect(await resolveSession(store, dev1, id, { parts: [{ unit: "R-2-DV", min: 10 }] })).toMatchObject({ ok: false, code: "NOT_MINE" });
    expect(await resolveSession(store, dev2, id, { off: true })).toMatchObject({ ok: false, status: 403 });
    expect(await resolveSession(store, dev1, id, { parts: [{ unit: "R-1-DS", min: 70 }] })).toMatchObject({ ok: false, code: "OVER" });
    expect((await resolveSession(store, dev1, id, { parts: [{ unit: "R-1-DS", min: 20 }, { unit: "R-1-DV", min: 40 }] })).ok).toBe(true);
    ix = await loadIndex(store);
    expect(ix.alloc.pending).toHaveLength(0);
    expect(ix.alloc.byUnitDay.get(`R-1-DV|${D}`)?.min).toBe(40);
  });

  it("텔레메트리 delta 는 같은 세션에 더해지고, 없는 계정은 버린다", async () => {
    await ingestOtel(store, [
      { userId: "dev01", sessionId: "s9", tool: "Claude Code", workDt: D, ms: Date.parse(D), minutes: 30, hints: ["R-1-DV"], branch: "" },
      { userId: "ghost", sessionId: "g", tool: "Claude Code", workDt: D, ms: Date.parse(D), minutes: 30, hints: [], branch: "" },
    ]);
    const ix = await loadIndex(store);
    expect(ix.data.sessions).toHaveLength(1);
    expect(ix.data.sessions[0].minutes).toBe(90);
    // 단계 코드가 늦게 잡히면 자동 배정으로 바뀐다
    expect(ix.alloc.byUnitDay.get(`R-1-DV|${D}`)?.min).toBe(90);
  });
});

describe("로그 업로드", () => {
  const file = (min: number) => ({ format: "poc-ai-sessions", version: 1, sessions: [{ tool: "Codex", sessionId: "c1", date: D, start: "10:00", end: "11:00", activeMin: min, branch: "main", hints: [] }] });

  it("형식 확인, 올린 사람 계정으로 저장, 다시 올려도 배정 유지", async () => {
    expect(await uploadLog(store, dev1, { foo: 1 })).toMatchObject({ ok: false, code: "BAD_FILE" });
    expect(await uploadLog(store, admin, file(30))).toMatchObject({ ok: false, status: 403 });
    expect((await uploadLog(store, dev1, file(30))).ok).toBe(true);
    let ix = await loadIndex(store);
    expect(ix.data.sessions[0].userId).toBe("dev01");
    await resolveSession(store, dev1, ix.alloc.pending[0].session.datId, { off: true });
    await uploadLog(store, dev1, file(45));
    ix = await loadIndex(store);
    expect(ix.data.sessions[0]).toMatchObject({ minutes: 45, resolution: { kind: "OFF" } });
    expect(ix.alloc.pending).toHaveLength(0);
  });
});

it("todayKst 는 YYYY-MM-DD", () => {
  expect(todayKst()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
