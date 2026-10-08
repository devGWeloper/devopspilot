import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import type { ActorFull } from "@/lib/auth/permissions";
import { getDraft, listVersions, publishDraft, saveCodes, saveDraft } from "@/lib/criteria/admin";
import { defaultCodes } from "@/lib/criteria/defaults";
import { getPublishedCriteria } from "@/lib/criteria/service";
import { createJsonStore } from "@/lib/store/json";
import { ensureSeed } from "@/lib/store/seed";
import type { Store } from "@/lib/store/types";

const admin: ActorFull = { userId: "admin", role: "AX_ADMIN", userNm: "AX 관리자", orgCd: "SKAX" };
const pm: ActorFull = { userId: "pm01", role: "PM", userNm: "PM", orgCd: "SKAX" };

let store: Store;
beforeEach(async () => {
  store = createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-crit-")));
  await ensureSeed(store, { samples: false });
});

describe("평가 기준 초안·게시", () => {
  it("초안이 없으면 게시본 사본", async () => {
    const d = await getDraft(store);
    expect(d.version).toBe(1);
    expect(d.areas).toHaveLength(4);
  });

  it("초안 저장은 게시본을 바꾸지 않는다", async () => {
    const d = await getDraft(store);
    d.areas[0].name = "바뀜";
    expect((await saveDraft(store, admin, d)).ok).toBe(true);
    expect((await getPublishedCriteria(store)).areas[0].name).toBe("과제 특성");
    expect((await getDraft(store)).areas[0].name).toBe("바뀜");
  });

  it("게시하면 버전이 오르고 과거 버전이 남는다", async () => {
    const d = await getDraft(store);
    d.rule.lowMinMajorLow = 3;
    await saveDraft(store, admin, d);
    const r = await publishDraft(store, admin);
    expect(r.ok && r.value.version).toBe(2);
    expect((await getPublishedCriteria(store)).rule.lowMinMajorLow).toBe(3);
    expect((await listVersions(store)).map((v) => v.version)).toEqual([2, 1]);
    expect((await getDraft(store)).version).toBe(2);
  });

  it("유효하지 않은 초안은 게시 거부", async () => {
    const d = await getDraft(store);
    d.areas.forEach((a) => a.indicators.forEach((i) => (i.tier = "MINOR")));
    await saveDraft(store, admin, d);
    expect(await publishDraft(store, admin)).toMatchObject({ ok: false, status: 422 });
  });

  it("관리자만", async () => {
    expect(await saveDraft(store, pm, await getDraft(store))).toMatchObject({ ok: false, status: 403 });
    expect(await publishDraft(store, pm)).toMatchObject({ ok: false, status: 403 });
  });
});

describe("코드·목표", () => {
  it("저장과 검증", async () => {
    const c = defaultCodes();
    c.target.total = 12;
    expect((await saveCodes(store, admin, c)).ok).toBe(true);
    const bad = defaultCodes();
    bad.langs.push({ code: "JAVA", label: "중복" });
    expect(await saveCodes(store, admin, bad)).toMatchObject({ ok: false, status: 422 });
    const neg = defaultCodes();
    neg.target.byFit.H = -1;
    expect(await saveCodes(store, admin, neg)).toMatchObject({ ok: false, status: 422 });
  });
});
