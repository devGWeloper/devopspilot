import { beforeEach, expect, it } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { assignStage } from "@/lib/projects/service";
import { createJsonStore } from "@/lib/store/json";
import type { Store } from "@/lib/store/types";
import { admin, dev1, mkProject, mkReq, mkStage, mkUser } from "./helpers";

let store: Store;
beforeEach(async () => {
  store = createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-asg-")));
  await store.users.insert(mkUser("dev01", "김개발"));
  await store.projects.insert(mkProject({ reqs: [mkReq({ reqId: "R-1", stages: [mkStage({ cd: "DV", ownerId: null, ownerNm: "", baseMd: 3, grade: "고급" })] })] }));
});

it("담당·측정 완료만 바꾸고 선정 항목은 그대로 · 관리자만", async () => {
  expect(await assignStage(store, dev1, "DAE01", { reqId: "R-1", cd: "DV", ownerId: "dev01" })).toMatchObject({ ok: false, status: 403 });
  expect(await assignStage(store, admin, "DAE01", { reqId: "R-1", cd: "DV", ownerId: "ghost" })).toMatchObject({ ok: false, code: "BAD_OWNER" });
  expect((await assignStage(store, admin, "DAE01", { reqId: "R-1", cd: "DV", ownerId: "dev01" })).ok).toBe(true);
  // 화면이 오래된 수정 시각을 들고 있어도 줄마다 바로 저장된다
  expect((await assignStage(store, admin, "DAE01", { reqId: "R-1", cd: "DV", done: true })).ok).toBe(true);
  let st = (await store.projects.get("DAE01"))!.reqs[0].stages[0];
  expect(st).toMatchObject({ ownerId: "dev01", ownerNm: "김개발", done: true, baseMd: 3, grade: "고급" });
  expect(st.doneAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await assignStage(store, admin, "DAE01", { reqId: "R-1", cd: "DV", done: false, ownerId: null });
  st = (await store.projects.get("DAE01"))!.reqs[0].stages[0];
  expect(st).toMatchObject({ ownerId: null, done: false, doneAt: null });
  expect(await assignStage(store, admin, "DAE01", { reqId: "R-1", cd: "TS", done: true })).toMatchObject({ ok: false, status: 404 });
});
