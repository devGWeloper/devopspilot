import type { ActorFull } from "../auth/permissions";
import { err, forbiddenR, notFoundR, okR, type ServiceResult } from "../result";
import type { Store } from "../store/types";

export type VocCat = "IMPROVE" | "BUG" | "QUESTION";
export type VocStatus = "OPEN" | "REVIEW" | "DONE" | "HOLD";

export const VOC_CAT: Record<VocCat, string> = { IMPROVE: "개선 요청", BUG: "오류", QUESTION: "문의" };
export const VOC_STATUS: Record<VocStatus, string> = { OPEN: "접수", REVIEW: "검토 중", DONE: "반영", HOLD: "보류" };

/** 개선 요청 한 건. 메신저로 흩어지던 VOC 를 한곳에 모아 처리 상태·답변을 요청자가 직접 보게 한다. */
export interface Voc {
  vocId: string;
  cat: VocCat;
  title: string;
  body: string;
  /** 어느 화면 얘기인지 — 메뉴 이름 */
  page: string;
  by: string;
  byNm: string;
  at: string;
  status: VocStatus;
  reply: string;
  replyNm: string;
  replyAt: string | null;
}

export interface VocInput {
  cat: VocCat;
  title: string;
  body: string;
  page?: string;
}

const now = () => new Date().toISOString();

const toRow = (v: Voc, by: string) => ({
  datId: v.vocId,
  kind: "VOC" as const,
  prjId: "-",
  reqId: null,
  workDt: v.at.slice(0, 10),
  userId: v.by,
  srcCd: "USER",
  data: v,
  regUserId: by,
  regAt: v.at,
  updAt: now(),
});

export async function listVoc(store: Store): Promise<Voc[]> {
  return (await store.meas.listAll("VOC")).map((r) => r.data as Voc).sort((a, b) => b.at.localeCompare(a.at));
}

export async function createVoc(store: Store, actor: ActorFull, input: VocInput): Promise<ServiceResult<Voc>> {
  const title = (input.title ?? "").trim();
  const body = (input.body ?? "").trim();
  if (!title) return err(400, "EMPTY", "제목을 입력해 주세요.");
  if (!(input.cat in VOC_CAT)) return err(400, "BAD_CAT", "구분을 골라 주세요.");
  const at = now();
  const v: Voc = {
    vocId: `V|${at}|${Math.random().toString(36).slice(2, 8)}`,
    cat: input.cat,
    title: title.slice(0, 100),
    body: body.slice(0, 4000),
    page: (input.page ?? "").trim().slice(0, 40),
    by: actor.userId,
    byNm: actor.userNm,
    at,
    status: "OPEN",
    reply: "",
    replyNm: "",
    replyAt: null,
  };
  await store.meas.upsert([toRow(v, actor.userId)]);
  return okR(v);
}

/** 상태·답변은 관리자만 — 요청자가 스스로 '반영'으로 닫지 않게 */
export async function answerVoc(store: Store, actor: ActorFull, vocId: string, input: { status?: VocStatus; reply?: string }): Promise<ServiceResult<Voc>> {
  if (actor.role !== "ADMIN") return forbiddenR("관리자만 답변할 수 있습니다.");
  const row = await store.meas.get(vocId);
  if (!row || row.kind !== "VOC") return notFoundR("개선 요청");
  const prev = row.data as Voc;
  if (input.status !== undefined && !(input.status in VOC_STATUS)) return err(400, "BAD_STATUS", "상태를 골라 주세요.");
  const reply = input.reply === undefined ? prev.reply : input.reply.trim().slice(0, 4000);
  const changed = reply !== prev.reply;
  const v: Voc = {
    ...prev,
    status: input.status ?? prev.status,
    reply,
    ...(changed ? { replyNm: actor.userNm, replyAt: now() } : {}),
  };
  await store.meas.upsert([{ ...row, data: v, updAt: now() }]);
  return okR(v);
}

/** 요청자는 답변이 달리기 전까지만 지울 수 있다 — 잘못 올린 글 정리용 */
export async function deleteVoc(store: Store, actor: ActorFull, vocId: string): Promise<ServiceResult<null>> {
  const row = await store.meas.get(vocId);
  if (!row || row.kind !== "VOC") return notFoundR("개선 요청");
  const v = row.data as Voc;
  const mineUntouched = v.by === actor.userId && v.status === "OPEN" && !v.reply;
  if (actor.role !== "ADMIN" && !mineUntouched) return forbiddenR("답변이 달린 요청은 지울 수 없습니다.");
  await store.meas.remove(vocId);
  return okR(null);
}
