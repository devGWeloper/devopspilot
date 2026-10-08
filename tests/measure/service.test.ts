import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import type { ActorFull } from "@/lib/auth/permissions";
import { loadInput } from "@/lib/measure/repo";
import { addDefect, applyUpload, saveTodayEfforts, setGridCell, upsertFeature } from "@/lib/measure/service";
import { createJsonStore } from "@/lib/store/json";
import { ensureSeed } from "@/lib/store/seed";
import type { Store } from "@/lib/store/types";

const admin: ActorFull = { userId: "admin", role: "AX_ADMIN", userNm: "AX 관리자", orgCd: "SKAX" };
const pm: ActorFull = { userId: "pm01", role: "PM", userNm: "김지훈", orgCd: "SKAX" };
const dev: ActorFull = { userId: "dev01", role: "DEVELOPER", userNm: "최민준", orgCd: "SKAX" };
const dev2: ActorFull = { userId: "dev02", role: "DEVELOPER", userNm: "정다은", orgCd: "SKAX" };
const qa: ActorFull = { userId: "qa01", role: "TESTER", userNm: "한예린", orgCd: "SKAX" };
const P = "PRJ-0001";

let store: Store;
beforeEach(async () => {
  store = createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-meas-")));
  await ensureSeed(store, { samples: true });
});

const effortsOf = async (wbs: string) => (await loadInput(store, [P])).efforts.filter((e) => e.wbsId === wbs);

describe("seed", () => {
  it("PRJ-0001 에 측정 seed 가 들어간다", async () => {
    const input = await loadInput(store, [P]);
    expect(input.features.map((f) => f.wbsId).sort()).toEqual(["WBS-3.2.1", "WBS-3.4.2", "WBS-4.1.3"]);
    expect(input.commits).toHaveLength(7);
    expect(input.settings.laborRatePerHour).toBe(60_000);
  });
});

describe("기능·기존 실적", () => {
  it("PM 이 MD 로 입력하면 h 로 환산", async () => {
    const r = await upsertFeature(store, pm, P, {
      wbsId: "WBS-9.9",
      name: "새 기능",
      typeCd: "SCREEN",
      devUserId: "dev01",
      status: "WAIT",
      completedAt: null,
      baseline: { DESIGN: 1, DEV: 2, UNIT: 0.5, INTEG: 0, defects: 0, evidence: "", evidenceVerified: false },
      note: "",
    }, "MD");
    expect(r.ok && r.value.baseline).toMatchObject({ DESIGN: 8, DEV: 16, UNIT: 4 });
    expect(r.ok && r.value.devUserNm).toBe("최민준");
  });

  it("선정되지 않은 과제는 409", async () => {
    const r = await upsertFeature(store, admin, "PRJ-0004", { wbsId: "W-1", name: "x", typeCd: "SCREEN", devUserId: null, status: "WAIT", completedAt: null, baseline: { DESIGN: 0, DEV: 0, UNIT: 0, INTEG: 0, defects: 0, evidence: "", evidenceVerified: false }, note: "" }, "h");
    expect(r).toMatchObject({ ok: false, status: 409, code: "NOT_MEASURING" });
  });

  it("개발자는 기능 등록 불가", async () => {
    const r = await upsertFeature(store, dev, P, { wbsId: "W-2", name: "x", typeCd: "SCREEN", devUserId: null, status: "WAIT", completedAt: null, baseline: { DESIGN: 0, DEV: 0, UNIT: 0, INTEG: 0, defects: 0, evidence: "", evidenceVerified: false }, note: "" }, "h");
    expect(r).toMatchObject({ ok: false, status: 403 });
  });
});

describe("오늘 공수 입력", () => {
  it("같은 날 같은 단계를 두 번 저장하면 1행, 나중 값", async () => {
    await saveTodayEfforts(store, dev, "2026-10-20", [{ prjId: P, wbsId: "WBS-3.2.1", phase: "DEV", hours: 2, aiLevel: "LEAD" }], []);
    await saveTodayEfforts(store, dev, "2026-10-20", [{ prjId: P, wbsId: "WBS-3.2.1", phase: "DEV", hours: 3, aiLevel: "LEAD" }], []);
    const rows = (await effortsOf("WBS-3.2.1")).filter((e) => e.workDt === "2026-10-20");
    expect(rows).toHaveLength(1);
    expect(rows[0].hours).toBe(3);
  });

  it("0 시간 저장은 그 날 기록을 지운다", async () => {
    await saveTodayEfforts(store, dev, "2026-10-20", [{ prjId: P, wbsId: "WBS-3.2.1", phase: "DEV", hours: 2, aiLevel: null }], []);
    await saveTodayEfforts(store, dev, "2026-10-20", [{ prjId: P, wbsId: "WBS-3.2.1", phase: "DEV", hours: 0, aiLevel: null }], []);
    expect((await effortsOf("WBS-3.2.1")).filter((e) => e.workDt === "2026-10-20")).toHaveLength(0);
  });

  it("남의 기능은 403, 시간 범위 밖은 422", async () => {
    expect(await saveTodayEfforts(store, dev2, "2026-10-20", [{ prjId: P, wbsId: "WBS-3.2.1", phase: "DEV", hours: 1, aiLevel: null }], [])).toMatchObject({ ok: false, status: 403 });
    expect(await saveTodayEfforts(store, dev, "2026-10-20", [{ prjId: P, wbsId: "WBS-3.2.1", phase: "DEV", hours: 25, aiLevel: null }], [])).toMatchObject({ ok: false, status: 422 });
  });

  it("완료 처리하면 완료일이 그 날짜", async () => {
    const r = await saveTodayEfforts(store, dev2, "2026-10-21", [], [{ prjId: P, wbsId: "WBS-4.1.3" }]);
    expect(r.ok).toBe(true);
    const f = (await loadInput(store, [P])).features.find((x) => x.wbsId === "WBS-4.1.3")!;
    expect(f).toMatchObject({ status: "DONE", completedAt: "2026-10-21" });
  });
});

describe("공수 기록표 그리드 보정", () => {
  it("합계를 직접 바꾸면 차이만큼 오늘 보정 행, 다시 바꾸면 그 행만 갱신", async () => {
    const sumDev = async () => (await effortsOf("WBS-3.2.1")).filter((e) => e.phase === "DEV").reduce((s, e) => s + e.hours, 0);
    expect(await sumDev()).toBe(9);
    const r1 = await setGridCell(store, dev, P, "WBS-3.2.1", "DEV", 13, "2026-10-20");
    expect(r1.ok && r1.value.adjustment).toBe(4);
    expect(await sumDev()).toBe(13);
    const r2 = await setGridCell(store, dev, P, "WBS-3.2.1", "DEV", 11, "2026-10-20");
    expect(r2.ok && r2.value.adjustment).toBe(2);
    expect(await sumDev()).toBe(11);
    expect((await effortsOf("WBS-3.2.1")).filter((e) => e.srcCd === "GRID")).toHaveLength(1);
  });

  it("음수 합계는 422", async () => {
    expect(await setGridCell(store, dev, P, "WBS-3.2.1", "DEV", -1, "2026-10-20")).toMatchObject({ ok: false, status: 422 });
  });
});

describe("결함·업로드", () => {
  it("테스트 수행자가 결함 등록, WBS 가 기능 목록에 없으면 422", async () => {
    expect((await addDefect(store, qa, P, { wbsId: "WBS-3.2.1", defectId: "QA-900", foundDt: "2026-10-20", phase: "UNIT", cause: "", severity: "NORMAL", title: "t", testCaseRef: "" })).ok).toBe(true);
    expect(await addDefect(store, qa, P, { wbsId: "WBS-0.0", defectId: "QA-901", foundDt: "2026-10-20", phase: "UNIT", cause: "", severity: "NORMAL", title: "t", testCaseRef: "" })).toMatchObject({ ok: false, status: 422 });
  });

  it("같은 커밋 CSV 재업로드 — 신규 0, 갱신 n", async () => {
    const csv = "hash,date,author,message,added,deleted\nz1,2026-10-20,k,[WBS-3.2.1] a,1,1\nz2,2026-10-20,k,b,2,2\n";
    const first = await applyUpload(store, pm, P, "commits", "c.csv", csv, false);
    expect(first.ok && first.value).toMatchObject({ inserted: 2, updated: 0 });
    const again = await applyUpload(store, pm, P, "commits", "c.csv", csv, false);
    expect(again.ok && again.value).toMatchObject({ inserted: 0, updated: 2 });
    expect((await loadInput(store, [P])).commits).toHaveLength(9);
  });

  it("dryRun 은 저장하지 않는다", async () => {
    const csv = "hash,date,author,message,added,deleted\nz9,2026-10-20,k,x,1,1\n";
    const r = await applyUpload(store, pm, P, "commits", "c.csv", csv, true);
    expect(r.ok && r.value.inserted).toBe(1);
    expect((await loadInput(store, [P])).commits).toHaveLength(7);
  });

  it("개발자 사용량 업로드는 본인 행만 반영", async () => {
    const csv = [
      "date,user,wbs_id,model,requests,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,source",
      "2026-10-20,dev01,WBS-3.2.1,claude-sonnet-4-5,1,1,1,1,1,claude",
      "2026-10-20,dev02,WBS-4.1.3,claude-sonnet-4-5,1,1,1,1,1,claude",
    ].join("\n");
    const r = await applyUpload(store, dev, P, "usage", "u.csv", csv, false);
    expect(r.ok && r.value.inserted).toBe(1);
    expect(r.ok && r.value.warnings.some((w) => w.message.includes("dev02"))).toBe(true);
  });

  it("업로드 이력이 남는다", async () => {
    await applyUpload(store, pm, P, "commits", "c.csv", "hash,date,author,message,added,deleted\nq1,2026-10-20,k,x,1,1\n", false);
    expect((await store.history.list({ targetTyp: "UPLOAD" }))[0].summary).toContain("커밋");
  });

  it("권한 없는 업로드 403", async () => {
    expect(await applyUpload(store, dev, P, "commits", "c.csv", "hash,date,author,message,added,deleted\n", false)).toMatchObject({ ok: false, status: 403 });
  });
});
