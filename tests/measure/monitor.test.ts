import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { kstDate } from "@/lib/measure/ingest";
import { aggTrace, traceUnits } from "@/lib/measure/metrics";
import { detectAnomalies } from "@/lib/measure/monitor";
import { addNote, confirmDays, listNotes, loadIndex, saveEffort, uploadLog } from "@/lib/measure/service";
import { dimValues } from "@/lib/dims";
import { createJsonStore } from "@/lib/store/json";
import { ensureSeed } from "@/lib/store/seed";
import type { Store } from "@/lib/store/types";
import { admin, dev1, mkProject, mkReq, mkStage, mkUser, sessionFile } from "../helpers";

const day = (n: number) => kstDate(Date.now() - n * 86400000);
const today = kstDate(Date.now());
let store: Store;

beforeEach(async () => {
  store = createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-mon-")));
  await ensureSeed(store, { samples: false });
  await store.users.insert(mkUser("dev01", "김개발"));
  await store.projects.insert(mkProject({ reqs: [mkReq({ reqId: "R-1", stages: [mkStage({ cd: "DV", ownerId: "dev01", baseMd: 2 })] })] }));
});

describe("산출 근거", () => {
  it("원장의 확정일만 더하면 집계 값과 같고, 세션의 배정 근거가 남는다", async () => {
    await uploadLog(store, dev1, sessionFile("s", day(3), 90, ["DAE01-R-1-DV"]));
    await saveEffort(store, dev1, { unit: "DAE01-R-1-DV", date: day(3), add: { A1: 2 } });
    await saveEffort(store, dev1, { unit: "DAE01-R-1-DV", date: day(2), add: { A1: 3 } });
    await confirmDays(store, dev1, "DAE01-R-1", [day(3)]);
    const ix = await loadIndex(store);
    const tr = traceUnits(ix, ix.units, true);
    const a = aggTrace(ix, tr);
    expect(a.tot).toBeCloseTo(3.5);
    expect(tr[0].days.filter((d) => !d.counted)).toHaveLength(1);
    const s = tr[0].days.find((d) => d.date === day(3))!.sessions[0];
    expect(s).toMatchObject({ src: "LOG", min: 90 });
    expect(s.how).toContain("DAE01-R-1-DV");
  });
});

describe("이상 감지", () => {
  it("같은 시간 반복·하루 과다를 찾는다", async () => {
    for (const n of [2, 3, 4, 5]) await saveEffort(store, dev1, { unit: "DAE01-R-1-DV", date: day(n), add: { A1: 8 } });
    await saveEffort(store, dev1, { unit: "DAE01-R-1-DV", date: day(6), add: { A1: 13 } });
    const ix = await loadIndex(store);
    const rules = detectAnomalies(ix, new Map([["dev01", "김개발"]]), today).map((a) => a.rule);
    expect(rules).toContain("SAME_HOURS");
    expect(rules).toContain("OVER_DAY");
    expect(rules).toContain("LATE_CONF");
  });

  it("한 세션에 여러 단계가 섞이면 사람별로 묶어 알린다", async () => {
    const p = (await store.projects.get("DAE01"))!;
    p.reqs[0].stages.push(mkStage({ cd: "TS", ownerId: "dev01" }));
    await store.projects.update(p, p.updAt);
    await uploadLog(store, dev1, sessionFile("m", day(2), 60, ["DAE01-R-1-DV", "DAE01-R-1-TS"]));
    const ix = await loadIndex(store);
    const a = detectAnomalies(ix, new Map([["dev01", "김개발"]]), today).find((x) => x.rule === "MIXED_STAGE");
    expect(a).toMatchObject({ userId: "dev01", date: day(2), title: "김개발 — 여러 단계가 섞인 Codex 세션 1건" });
  });

  it("확인 기록은 관리자만, 내용 필수, 최신순", async () => {
    expect(await addNote(store, dev1, { key: "K", status: "OK", text: "x" })).toMatchObject({ ok: false, status: 403 });
    expect(await addNote(store, admin, { key: "K", status: "OK", text: " " })).toMatchObject({ ok: false, code: "EMPTY" });
    await addNote(store, admin, { key: "K", status: "ACTION", text: "팀장 문의 예정" });
    await addNote(store, admin, { key: "K", status: "OK", contact: "김팀장", method: "전화", text: "문제없음" });
    const ns = await listNotes(store);
    expect(ns.map((n) => n.status)).toEqual(["OK", "ACTION"]);
    expect(ns[0]).toMatchObject({ contact: "김팀장", method: "전화", byNm: "관리자" });
  });
});

describe("분류 축", () => {
  it("태그 단위 속성과 과제 속성을 함께 낸다", () => {
    const v = dimValues(mkProject({ area: "전환" }), mkStage({ cd: "TS", fit: "상", grade: "고급", spec: "중" }));
    expect(v).toMatchObject({ fit: "상", grade: "고급", spec: "중", stage: "테스트", area: "전환" });
  });
});

