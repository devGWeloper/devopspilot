import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { kstDate } from "@/lib/measure/ingest";
import { aggTrace, traceUnits } from "@/lib/measure/metrics";
import { detectAnomalies } from "@/lib/measure/monitor";
import { addNote, confirmDays, ingestOtel, listNotes, loadIndex, saveEffort } from "@/lib/measure/service";
import { dimValues } from "@/lib/dims";
import { createJsonStore } from "@/lib/store/json";
import { ensureSeed } from "@/lib/store/seed";
import type { Store } from "@/lib/store/types";
import { admin, dev1, mkProject, mkReq, mkStage } from "../helpers";

const day = (n: number) => kstDate(Date.now() - n * 86400000);
const today = kstDate(Date.now());
let store: Store;

beforeEach(async () => {
  store = createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-mon-")));
  await ensureSeed(store, { samples: false });
  // 텔레메트리는 등록된 사용자 것만 받는다
  await store.users.insert({ userId: "dev01", userNm: "김개발", orgCd: "SKAX", deptNm: "", role: "DEVELOPER", useYn: true, pwdHash: "x", pwdSalt: "x", lastLoginAt: null, regAt: "", updAt: "" });
  await store.projects.insert(mkProject({ reqs: [mkReq({ reqId: "R-1", stages: [mkStage({ cd: "DV", ownerId: "dev01", baseMd: 2 })] })] }));
});

describe("산출 근거", () => {
  it("원장의 확정일만 더하면 집계 값과 같고, 세션의 배정 근거가 남는다", async () => {
    await ingestOtel(store, [{ userId: "dev01", sessionId: "s", tool: "Claude Code", workDt: day(3), ms: Date.parse(day(3)), minutes: 90, hints: ["R-1-DV"], branch: "" }]);
    await saveEffort(store, dev1, { unit: "R-1-DV", date: day(3), add: { A1: 2 } });
    await saveEffort(store, dev1, { unit: "R-1-DV", date: day(2), add: { A1: 3 } });
    await confirmDays(store, dev1, "R-1", [day(3)]);
    const ix = await loadIndex(store);
    const tr = traceUnits(ix, ix.units, true);
    const a = aggTrace(ix, tr);
    expect(a.tot).toBeCloseTo(3.5);
    expect(tr[0].days.filter((d) => !d.counted)).toHaveLength(1);
    const s = tr[0].days.find((d) => d.date === day(3))!.sessions[0];
    expect(s).toMatchObject({ src: "OTEL", min: 90 });
    expect(s.how).toContain("R-1-DV");
  });
});

describe("이상 감지", () => {
  it("같은 시간 반복·하루 과다를 찾는다", async () => {
    for (const n of [2, 3, 4, 5]) await saveEffort(store, dev1, { unit: "R-1-DV", date: day(n), add: { A1: 8 } });
    await saveEffort(store, dev1, { unit: "R-1-DV", date: day(6), add: { A1: 13 } });
    const ix = await loadIndex(store);
    const rules = detectAnomalies(ix, new Map([["dev01", "김개발"]]), today).map((a) => a.rule);
    expect(rules).toContain("SAME_HOURS");
    expect(rules).toContain("OVER_DAY");
    expect(rules).toContain("LATE_CONF");
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
  it("기대효과는 PM 판단이 우선, 없으면 참고 등급 첫 글자", () => {
    const p = mkProject();
    expect(dimValues(p, mkReq({ extra: { "FIT-05": "중 (맥락)", "FIT-06": "상" } })).fit).toBe("상");
    expect(dimValues(p, mkReq({ extra: { "FIT-05": "하 (명세)" } })).fit).toBe("하");
    expect(dimValues(p, mkReq({ stages: [mkStage({ cd: "DS", baseMd: 1 }), mkStage({ cd: "DV", baseMd: 3 })] })).stage).toBe("개발");
  });
});
