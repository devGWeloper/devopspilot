import { beforeEach, expect, it } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { createJsonStore } from "@/lib/store/json";
import type { Store } from "@/lib/store/types";
import { answerVoc, createVoc, deleteVoc, listVoc } from "@/lib/voc/service";
import { admin, dev1, dev2, viewer } from "./helpers";

let store: Store;
beforeEach(() => {
  store = createJsonStore(mkdtempSync(path.join(tmpdir(), "poc-voc-")));
});

it("누구나 남기고 모두 볼 수 있다 · 제목 필수", async () => {
  expect(await createVoc(store, dev1, { cat: "IMPROVE", title: " ", body: "" })).toMatchObject({ ok: false, code: "EMPTY" });
  expect((await createVoc(store, dev1, { cat: "BUG", title: "업로드 오류", body: "폴더 선택 시 멈춤", page: "공수 입력" })).ok).toBe(true);
  expect((await createVoc(store, viewer, { cat: "QUESTION", title: "지표 뜻" , body: "" })).ok).toBe(true);
  const list = await listVoc(store);
  expect(list.map((v) => v.title)).toEqual(["지표 뜻", "업로드 오류"]);
  expect(list[1]).toMatchObject({ status: "OPEN", by: "dev01", byNm: "김개발", page: "공수 입력" });
});

it("답변·상태는 관리자만, 답변이 달리면 요청자는 못 지운다", async () => {
  const r = await createVoc(store, dev1, { cat: "IMPROVE", title: "일괄 이동", body: "" });
  if (!r.ok) throw new Error();
  const id = r.value.vocId;
  expect(await answerVoc(store, dev1, id, { status: "DONE" })).toMatchObject({ ok: false, status: 403 });
  expect(await deleteVoc(store, dev2, id)).toMatchObject({ ok: false, status: 403 });
  const a = await answerVoc(store, admin, id, { status: "REVIEW", reply: "다음 배포에 반영 예정" });
  expect(a).toMatchObject({ ok: true, value: { status: "REVIEW", reply: "다음 배포에 반영 예정", replyNm: "관리자" } });
  expect(await deleteVoc(store, dev1, id)).toMatchObject({ ok: false, status: 403 });
  expect((await deleteVoc(store, admin, id)).ok).toBe(true);
  expect(await listVoc(store)).toHaveLength(0);
});
