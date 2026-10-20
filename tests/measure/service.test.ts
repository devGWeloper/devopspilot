import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { kstDate } from "@/lib/measure/ingest";
import { rowsOf } from "@/lib/measure/metrics";
import { confirmDate, confirmDays, ingestOtel, loadIndex, reopenDay, resolveSession, saveEffort, todayKst, uploadLog } from "@/lib/measure/service";
import { createJsonStore } from "@/lib/store/json";
import { ensureSeed } from "@/lib/store/seed";
import type { Store } from "@/lib/store/types";
import { admin, dev1, dev2, mkProject, mkReq, mkStage, mkUser, otelEvents } from "../helpers";

// 오늘 이후 날짜는 서비스가 거부하므로 실행일 기준 과거로 잡는다.
const D = kstDate(Date.now() - 3 * 86400000);
const DV = "DAE01-R-1-DV";
const DS = "DAE01-R-1-DS";
let store: Store;

beforeEach(async () => {
  store = createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-svc-")));
  await ensureSeed(store, { samples: false });
  await store.users.insert(mkUser("dev01", "김개발", { aiAcct: "kim@corp.com" }));
  await store.users.insert(mkUser("dev02", "박개발"));
  await store.projects.insert(
    mkProject({
      reqs: [
        mkReq({ reqId: "R-1", stages: [mkStage({ cd: "DS", ownerId: "dev01" }), mkStage({ cd: "DV", ownerId: "dev01" })] }),
        mkReq({ reqId: "R-2", stages: [mkStage({ cd: "DV", ownerId: "dev02" })] }),
      ],
    }),
  );
});


describe("공수 입력·확정", () => {
  it("담당 개발자만, 오늘 이후·A8 메모 없음은 거부", async () => {
    expect((await saveEffort(store, dev1, { unit: DV, date: D, add: { A1: 2 } })).ok).toBe(true);
    expect(await saveEffort(store, dev2, { unit: DV, date: D, add: { A1: 2 } })).toMatchObject({ ok: false, status: 403 });
    expect(await saveEffort(store, admin, { unit: DV, date: D, add: { A1: 2 } })).toMatchObject({ ok: false, status: 403 });
    expect(await saveEffort(store, dev1, { unit: DV, date: "2999-01-01", add: { A1: 1 } })).toMatchObject({ ok: false, code: "BAD_DATE" });
    expect(await saveEffort(store, dev1, { unit: DV, date: D, add: { A8: 1 } })).toMatchObject({ ok: false, code: "MEMO_REQUIRED" });
  });

  it("AI 도구 내 시간은 수집값보다 크게 못 넣는다", async () => {
    await ingestOtel(store, otelEvents("kim@corp.com", "s", D, 120, [DV]));
    expect(await saveEffort(store, dev1, { unit: DV, date: D, inT: 3 })).toMatchObject({ ok: false, code: "OVER_COLLECTED" });
    expect((await saveEffort(store, dev1, { unit: DV, date: D, inT: 1.5 })).ok).toBe(true);
    const ix = await loadIndex(store);
    expect(ix.effort.get(`${DV}|${D}`)?.reduceH).toBe(0.5);
  });

  it("확정 → 확정된 날은 못 고침 → 수정(해제) → 다시 확정 시 수정 횟수, 첫 확정 시각 유지", async () => {
    await saveEffort(store, dev1, { unit: DV, date: D, add: { A1: 2 } });
    expect(await confirmDays(store, dev1, "DAE01-R-1")).toMatchObject({ ok: true, value: { count: 1 } });
    const first = (await loadIndex(store)).data.confs[0].firstConfirmedAt;
    expect(first).toBeTruthy();
    expect(await saveEffort(store, dev1, { unit: DV, date: D, add: { A1: 3 } })).toMatchObject({ ok: false, code: "CONFIRMED" });
    expect((await reopenDay(store, dev1, "DAE01-R-1", D)).ok).toBe(true);
    expect((await saveEffort(store, dev1, { unit: DV, date: D, add: { A1: 3 } })).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    await confirmDays(store, dev1, "DAE01-R-1", [D]);
    const ix = await loadIndex(store);
    expect(rowsOf(ix, "dev01", ix.data.projects[0].reqs[0])[0]).toMatchObject({ st: "conf", revCount: 1 });
    expect(ix.data.confs[0].firstConfirmedAt).toBe(first);
    expect(ix.data.confs[0].confirmedAt).not.toBe(first);
    expect((await store.history.list({ targetTyp: "EFFORT" })).length).toBeGreaterThan(0);
  });

  it("하루 확정 — 그날 기록이 있는 내 요구사항만, 개발자 본인만", async () => {
    await store.projects.insert(mkProject({ prjId: "DAE02", reqs: [mkReq({ reqId: "R-9", stages: [mkStage({ cd: "TS", ownerId: "dev01" })] })] }));
    await saveEffort(store, dev1, { unit: DV, date: D, add: { A1: 2 } });
    await saveEffort(store, dev1, { unit: "DAE02-R-9-TS", date: D, add: { A2: 1 } });
    await saveEffort(store, dev2, { unit: "DAE01-R-2-DV", date: D, add: { A1: 1 } });
    expect(await confirmDate(store, admin, D)).toMatchObject({ ok: false, status: 403 });
    expect(await confirmDate(store, dev1, D)).toMatchObject({ ok: true, value: { count: 2 } });
    const ix = await loadIndex(store);
    expect(ix.data.confs.map((c) => [c.userId, c.prjId, c.reqId]).sort()).toEqual([
      ["dev01", "DAE01", "R-1"],
      ["dev01", "DAE02", "R-9"],
    ]);
    expect(await confirmDate(store, dev1, D)).toMatchObject({ ok: true, value: { count: 0 } });
  });

  it("측정 완료 태그는 입력 불가", async () => {
    const p = (await store.projects.get("DAE01"))!;
    p.reqs[0].stages[1].done = true;
    await store.projects.update(p, p.updAt);
    expect(await saveEffort(store, dev1, { unit: DV, date: D, add: { A1: 1 } })).toMatchObject({ ok: false, code: "DONE" });
    expect((await saveEffort(store, dev1, { unit: DS, date: D, add: { A1: 1 } })).ok).toBe(true);
  });
});

describe("AI 사용 배정", () => {
  beforeEach(async () => {
    await ingestOtel(store, otelEvents("kim@corp.com", "s9", D, 60, ["DAE01-R-1"]));
  });

  it("단계가 둘이면 확인 필요 → 나눠 배정하면 사라진다", async () => {
    let ix = await loadIndex(store);
    expect(ix.alloc.pending).toHaveLength(1);
    const id = ix.alloc.pending[0].session.datId;
    expect(await resolveSession(store, dev1, id, { parts: [{ unit: "DAE01-R-2-DV", min: 10 }] })).toMatchObject({ ok: false, code: "NOT_MINE" });
    expect(await resolveSession(store, dev2, id, { off: true })).toMatchObject({ ok: false, status: 403 });
    expect(await resolveSession(store, dev1, id, { parts: [{ unit: DS, min: 70 }] })).toMatchObject({ ok: false, code: "OVER" });
    expect((await resolveSession(store, dev1, id, { parts: [{ unit: DS, min: 20 }, { unit: DV, min: 40 }] })).ok).toBe(true);
    ix = await loadIndex(store);
    expect(ix.alloc.pending).toHaveLength(0);
    expect(ix.alloc.byUnitDay.get(`${DV}|${D}`)?.min).toBe(40);
  });

  it("이어 들어온 이벤트는 같은 세션에 더해지고, 계정을 못 찾으면 버린다 · AI 도구 계정 또는 사번으로 매핑", async () => {
    const after = Date.parse(`${D}T01:00:00Z`) + 61 * 60000;
    await ingestOtel(store, [
      ...otelEvents("kim@corp.com", "s9", D, 29, [DV], after),
      ...otelEvents("ghost@corp.com", "g", D, 30),
      ...otelEvents("dev02@corp.com", "p", D, 10),
    ]);
    const ix = await loadIndex(store);
    expect(ix.data.sessions.map((s) => s.userId).sort()).toEqual(["dev01", "dev02"]);
    const s = ix.data.sessions.find((x) => x.userId === "dev01")!;
    expect(s.minutes).toBe(90);
    // 태그가 늦게 잡히면 자동 배정으로 바뀐다
    expect(ix.alloc.byUnitDay.get(`${DV}|${D}`)?.min).toBe(90);
  });

  it("토큰은 모델별로 쌓인다", async () => {
    const e = otelEvents("kim@corp.com", "s9", D, 1).map((x) => ({ ...x, tokens: { input: 100, cached: 10, output: 5 } }));
    await ingestOtel(store, e);
    await ingestOtel(store, e.slice(0, 1));
    const s = (await loadIndex(store)).data.sessions[0];
    expect(s.tokens).toEqual({ "gpt-5-codex": { input: 300, cached: 30, output: 15 } });
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
