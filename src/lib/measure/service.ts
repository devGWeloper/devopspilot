import { can, type ActorFull } from "../auth/permissions";
import { record } from "../history";
import { err, forbiddenR, notFoundR, okR, type ServiceResult } from "../result";
import type { MeasRow, Store } from "../store/types";
import type { Project } from "../types";
import { normalizeSettings, SETTINGS_KEY } from "./defaults";
import { kstDate, kstTime, parseLogUpload, type OtelDelta } from "./ingest";
import type { StoredSession } from "./match";
import { buildIndex, cellOf, confKey, dayState, daySnap, rowsOf, type Index, type MeasureData } from "./metrics";
import { ACT_TYPES, type ActType, type AiSession, type DayConf, type EffortEntry, type MonitorNote, type NoteStatus, type Settings } from "./types";

export async function getSettings(store: Store): Promise<Settings> {
  return normalizeSettings((await store.config.get<Settings>(SETTINGS_KEY))?.value);
}

export async function loadData(store: Store): Promise<MeasureData> {
  const [projects, rows, settings] = await Promise.all([store.projects.list(), store.meas.listAll(), getSettings(store)]);
  const efforts: EffortEntry[] = [];
  const confs: DayConf[] = [];
  const sessions: StoredSession[] = [];
  for (const r of rows) {
    if (r.kind === "EFFORT") efforts.push(r.data as EffortEntry);
    else if (r.kind === "CONF") confs.push(r.data as DayConf);
    else if (r.kind === "AIUSE") sessions.push({ ...(r.data as AiSession), datId: r.datId });
  }
  return { projects, efforts, confs, sessions, settings };
}

export async function loadIndex(store: Store): Promise<Index> {
  return buildIndex(await loadData(store));
}

export const todayKst = () => kstDate(Date.now());

const effortId = (unit: string, date: string) => `E|${unit}|${date}`;
const confId = (userId: string, reqId: string, date: string) => `C|${userId}|${reqId}|${date}`;
export const sessionId = (src: string, sid: string, date: string) => `A|${src}|${sid}|${date}`;

function row(kind: MeasRow["kind"], datId: string, base: { prjId: string; reqId: string | null; workDt: string; userId: string | null }, data: unknown, src: string, by: string): MeasRow {
  const now = new Date().toISOString();
  return { datId, kind, prjId: base.prjId, reqId: base.reqId, workDt: base.workDt, userId: base.userId, srcCd: src, data, regUserId: by, regAt: now, updAt: now };
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const round1 = (v: number) => Math.round(v * 10) / 10;

export interface EffortInput {
  unit: string;
  date: string;
  /** AI 도구 내 시간(h) — 수집값 이하로만. 없으면 그대로 */
  inT?: number;
  add?: Partial<Record<ActType, number>>;
  memo?: string;
}

export async function saveEffort(store: Store, actor: ActorFull, input: EffortInput): Promise<ServiceResult<null>> {
  const ix = await loadIndex(store);
  const u = ix.unitByCode.get(input.unit);
  if (!u) return notFoundR("단계");
  if (!can(actor, "effort.edit", { ownerId: u.ownerId })) return forbiddenR("내 담당 단계만 입력할 수 있습니다.");
  if (!isDate(input.date) || input.date > todayKst()) return err(400, "BAD_DATE", "오늘 이후 날짜는 입력할 수 없습니다.");
  if (u.req.done) return err(409, "DONE", "측정 완료된 요구사항입니다.");
  if (dayState(ix, actor.userId, u.req, input.date).st === "conf")
    return err(409, "CONFIRMED", "확정된 날입니다. '수정'을 눌러 확정을 푼 뒤 고쳐 주세요.");

  const cur = cellOf(ix, u.code, input.date);
  const prev = ix.effort.get(`${u.code}|${input.date}`);
  const next: EffortEntry = {
    unit: u.code,
    prjId: u.prjId,
    reqId: u.reqId,
    stage: u.stage,
    userId: actor.userId,
    workDt: input.date,
    reduceH: prev?.reduceH ?? 0,
    add: prev?.add ?? {},
    memo: prev?.memo ?? "",
  };
  if (input.inT !== undefined) {
    const v = round1(Number(input.inT));
    if (!Number.isFinite(v) || v < 0) return err(400, "BAD_VALUE", "AI 도구 내 시간은 0 이상이어야 합니다.");
    if (v > round1(cur.ai)) return err(400, "OVER_COLLECTED", `수집값 ${round1(cur.ai)}h 보다 크게 넣을 수 없습니다. 수집되지 않은 AI 사용은 A7 로 넣어 주세요.`);
    next.reduceH = round1(cur.ai - v);
  }
  if (input.add !== undefined) {
    const add: Partial<Record<ActType, number>> = {};
    for (const t of ACT_TYPES) {
      const v = round1(Number(input.add[t.cd] ?? 0));
      if (!Number.isFinite(v) || v < 0) return err(400, "BAD_VALUE", `${t.label} 시간이 올바르지 않습니다.`);
      if (v > 0) add[t.cd] = v;
    }
    next.add = add;
    next.memo = (input.memo ?? "").trim().slice(0, 200);
    if (add.A8 && !next.memo) return err(400, "MEMO_REQUIRED", "A8 기타는 메모를 적어 주세요.");
  }
  const total = cur.ai - Math.min(cur.ai, next.reduceH) + Object.values(next.add).reduce((a, b) => a + (b ?? 0), 0);
  if (total > 16) return err(400, "TOO_MANY", "한 단계 하루 투입이 16시간을 넘습니다. 값을 확인해 주세요.");

  await store.meas.upsert([row("EFFORT", effortId(u.code, input.date), { ...next, reqId: u.reqId }, next, "MANUAL", actor.userId)]);
  return okR(null);
}

function findReq(projects: Project[], reqId: string) {
  for (const p of projects) {
    const r = p.reqs.find((x) => x.reqId === reqId);
    if (r) return { prj: p, req: r };
  }
  return null;
}

/** 확정 — dates 를 안 주면 확정 필요한 날 전부 */
export async function confirmDays(store: Store, actor: ActorFull, reqId: string, dates?: string[]): Promise<ServiceResult<{ count: number }>> {
  const ix = await loadIndex(store);
  const f = findReq(ix.data.projects, reqId);
  if (!f) return notFoundR("요구사항");
  if (!can(actor, "effort.edit", { req: f.req })) return forbiddenR("내 담당 요구사항만 확정할 수 있습니다.");
  const rows = rowsOf(ix, actor.userId, f.req).filter((r) => r.st !== "conf" && (!dates || dates.includes(r.date)));
  const now = new Date().toISOString();
  const out = rows.map((r) => {
    const prev = ix.conf.get(confKey(actor.userId, reqId, r.date));
    const reconfirm = !!prev && (prev.state === "EDIT" || prev.state === "CONF");
    const c: DayConf = {
      userId: actor.userId,
      prjId: f.prj.prjId,
      reqId,
      workDt: r.date,
      state: "CONF",
      confirmedAt: now,
      revCount: (prev?.revCount ?? 0) + (reconfirm ? 1 : 0),
      snap: daySnap(ix, actor.userId, f.req, r.date),
    };
    return row("CONF", confId(actor.userId, reqId, r.date), { prjId: f.prj.prjId, reqId, workDt: r.date, userId: actor.userId }, c, "MANUAL", actor.userId);
  });
  await store.meas.upsert(out);
  if (rows.some((r) => r.revCount > 0 || r.st === "edit"))
    await record(store, actor, { targetTyp: "EFFORT", targetId: reqId, actionCd: "RECONFIRM", summary: `${reqId} ${rows.map((r) => r.date).join(", ")} 재확정` });
  return okR({ count: out.length });
}

async function setConfState(store: Store, actor: ActorFull, reqId: string, date: string, state: "EDIT" | "EXTRA"): Promise<ServiceResult<null>> {
  const ix = await loadIndex(store);
  const f = findReq(ix.data.projects, reqId);
  if (!f) return notFoundR("요구사항");
  if (!can(actor, "effort.edit", { req: f.req })) return forbiddenR("내 담당 요구사항만 고칠 수 있습니다.");
  if (!isDate(date) || date > todayKst()) return err(400, "BAD_DATE", "오늘 이후 날짜는 고를 수 없습니다.");
  const prev = ix.conf.get(confKey(actor.userId, reqId, date));
  if (state === "EXTRA" && (prev || rowsOf(ix, actor.userId, f.req).some((r) => r.date === date)))
    return err(409, "EXISTS", "이미 입력 줄이 있는 날입니다.");
  if (state === "EDIT" && prev?.state !== "CONF") return err(409, "NOT_CONFIRMED", "확정된 날이 아닙니다.");
  const c: DayConf = {
    userId: actor.userId,
    prjId: f.prj.prjId,
    reqId,
    workDt: date,
    state,
    confirmedAt: prev?.confirmedAt ?? null,
    revCount: prev?.revCount ?? 0,
    snap: prev?.snap ?? {},
  };
  await store.meas.upsert([row("CONF", confId(actor.userId, reqId, date), { prjId: f.prj.prjId, reqId, workDt: date, userId: actor.userId }, c, "MANUAL", actor.userId)]);
  if (state === "EDIT") await record(store, actor, { targetTyp: "EFFORT", targetId: reqId, actionCd: "UNCONFIRM", summary: `${reqId} ${date} 확정 해제(수정)`, diff: { before: prev?.snap } });
  return okR(null);
}

export const reopenDay = (store: Store, actor: ActorFull, reqId: string, date: string) => setConfState(store, actor, reqId, date, "EDIT");
export const addExtraDay = (store: Store, actor: ActorFull, reqId: string, date: string) => setConfState(store, actor, reqId, date, "EXTRA");

/** 하루 단위 확정 — 공수 입력 화면은 날짜 하나를 한 번에 확정한다. 저장은 기존처럼 요구사항별로 남는다. */
export async function confirmDate(store: Store, actor: ActorFull, date: string): Promise<ServiceResult<{ count: number }>> {
  if (actor.role !== "DEVELOPER") return forbiddenR("개발자 본인만 확정할 수 있습니다.");
  const ix = await loadIndex(store);
  const reqs = ix.data.projects
    .flatMap((p) => p.reqs)
    .filter((r) => rowsOf(ix, actor.userId, r).some((x) => x.date === date && x.st !== "conf"));
  if (reqs.length === 0) return err(409, "NOTHING", "확정할 입력이 없습니다.");
  let count = 0;
  for (const r of reqs) {
    const res = await confirmDays(store, actor, r.reqId, [date]);
    if (!res.ok) return res;
    count += res.value.count;
  }
  return okR({ count });
}

export async function reopenDate(store: Store, actor: ActorFull, date: string): Promise<ServiceResult<null>> {
  if (actor.role !== "DEVELOPER") return forbiddenR("개발자 본인만 고칠 수 있습니다.");
  const ix = await loadIndex(store);
  const reqs = ix.data.projects.flatMap((p) => p.reqs).filter((r) => !r.done && ix.conf.get(confKey(actor.userId, r.reqId, date))?.state === "CONF");
  if (reqs.length === 0) return err(409, "NOT_CONFIRMED", "고칠 수 있는 확정이 없습니다. (측정 완료된 요구사항은 고칠 수 없습니다)");
  for (const r of reqs) {
    const res = await reopenDay(store, actor, r.reqId, date);
    if (!res.ok) return res;
  }
  return okR(null);
}

export type ResolveInput = { off: true } | { parts: { unit: string; min: number }[] };

export async function resolveSession(store: Store, actor: ActorFull, datId: string, input: ResolveInput): Promise<ServiceResult<null>> {
  const r = await store.meas.get(datId);
  if (!r || r.kind !== "AIUSE") return notFoundR("AI 사용 기록");
  const s = r.data as AiSession;
  if (actor.role !== "DEVELOPER" || s.userId !== actor.userId) return forbiddenR("본인 AI 사용만 처리할 수 있습니다.");
  const at = new Date().toISOString();
  if ("off" in input) {
    s.resolution = { kind: "OFF", by: actor.userId, at };
  } else {
    const ix = await loadIndex(store);
    const parts = (input.parts ?? []).map((p) => ({ unit: p.unit, min: Math.round(Number(p.min)) })).filter((p) => p.min > 0);
    if (parts.length === 0) return err(400, "EMPTY", "배정할 시간을 넣어 주세요.");
    const sum = parts.reduce((a, p) => a + p.min, 0);
    if (sum > s.minutes) return err(400, "OVER", `${s.minutes}분을 넘을 수 없습니다.`);
    for (const p of parts) {
      const u = ix.unitByCode.get(p.unit);
      if (!u || u.ownerId !== actor.userId) return err(400, "NOT_MINE", `${p.unit} 은(는) 내 담당 단계가 아닙니다.`);
      if (u.req.done) return err(400, "DONE", `${p.unit} 은(는) 측정 완료된 요구사항입니다.`);
    }
    s.resolution = { kind: "ASSIGN", parts, by: actor.userId, at };
  }
  await store.meas.upsert([{ ...r, data: s, updAt: at }]);
  return okR(null);
}

/** 로컬 로그 업로드 — 같은 세션·일자를 다시 올리면 시간만 갱신하고, 개발자가 처리한 배정은 유지한다. */
export async function uploadLog(store: Store, actor: ActorFull, raw: unknown): Promise<ServiceResult<{ sessions: number; warnings: string[] }>> {
  if (!can(actor, "effort.upload")) return forbiddenR("개발자 계정만 올릴 수 있습니다.");
  const parsed = parseLogUpload(raw);
  if ("error" in parsed) return err(400, "BAD_FILE", parsed.error);
  const existing = new Map((await store.meas.listAll("AIUSE")).map((r) => [r.datId, r]));
  const rows = parsed.sessions.map((p) => {
    const id = sessionId("LOG", p.sessionId, p.workDt);
    const prev = existing.get(id)?.data as AiSession | undefined;
    const s: AiSession = { ...p, userId: actor.userId, resolution: prev?.resolution ?? null };
    return row("AIUSE", id, { prjId: "-", reqId: null, workDt: p.workDt, userId: actor.userId }, s, "LOG", actor.userId);
  });
  await store.meas.upsert(rows);
  await record(store, actor, { targetTyp: "UPLOAD", targetId: actor.userId, actionCd: "AI_LOG", summary: `AI 사용 기록 ${rows.length}건 업로드` });
  return okR({ sessions: rows.length, warnings: parsed.warnings });
}

/** 텔레메트리 수신 — delta 를 세션·일자 행에 더한다. 동시 수신 시 같은 행을 겹쳐 쓸 수 있으나 PoC 규모(개발자 수십 명)에선 수용. */
export async function ingestOtel(store: Store, deltas: OtelDelta[]): Promise<number> {
  if (deltas.length === 0) return 0;
  const users = new Set((await store.users.list()).filter((u) => u.useYn).map((u) => u.userId));
  const grouped = new Map<string, OtelDelta[]>();
  for (const d of deltas) {
    if (!users.has(d.userId)) continue;
    const id = sessionId("OTEL", d.sessionId, d.workDt);
    grouped.set(id, [...(grouped.get(id) ?? []), d]);
  }
  const rows: MeasRow[] = [];
  for (const [id, list] of Array.from(grouped)) {
    const prev = (await store.meas.get(id))?.data as AiSession | undefined;
    const first = list[0];
    const times = list.map((d) => d.ms);
    const s: AiSession = {
      src: "OTEL",
      sessionId: first.sessionId,
      userId: first.userId,
      workDt: first.workDt,
      tool: first.tool,
      minutes: Math.round((prev?.minutes ?? 0) + list.reduce((a, d) => a + d.minutes, 0)),
      start: prev?.start || kstTime(Math.min(...times)),
      end: kstTime(Math.max(...times)),
      branch: prev?.branch || first.branch,
      hints: Array.from(new Set([...(prev?.hints ?? []), ...list.flatMap((d) => d.hints)])).slice(0, 20),
      resolution: prev?.resolution ?? null,
    };
    rows.push(row("AIUSE", id, { prjId: "-", reqId: null, workDt: s.workDt, userId: s.userId }, s, "OTEL", "otel"));
  }
  await store.meas.upsert(rows);
  return rows.length;
}

export async function saveSettings(store: Store, actor: ActorFull, v: Settings): Promise<ServiceResult<Settings>> {
  if (!can(actor, "settings.manage")) return forbiddenR();
  const s = normalizeSettings(v);
  if (!isDate(s.measureStart)) return err(400, "BAD_DATE", "측정 시작일 형식이 올바르지 않습니다.");
  if (Object.values(s.gradePrice).some((x) => !(x >= 0)) || Object.values(s.aiRate).some((x) => !(x >= 0)))
    return err(400, "BAD_VALUE", "단가는 0 이상 숫자여야 합니다.");
  const prev = await store.config.get<Settings>(SETTINGS_KEY);
  await store.config.set(SETTINGS_KEY, s, (prev?.verNo ?? 0) + 1, actor.userId);
  await record(store, actor, { targetTyp: "SETTINGS", targetId: SETTINGS_KEY, actionCd: "UPDATE", summary: "코드·단가 변경", diff: { before: prev?.value, after: s } });
  return okR(s);
}


export async function listNotes(store: Store): Promise<MonitorNote[]> {
  return (await store.meas.listAll("NOTE")).map((r) => r.data as MonitorNote).sort((a, b) => b.at.localeCompare(a.at));
}

export interface NoteInput {
  key: string;
  status: NoteStatus;
  method?: string;
  contact?: string;
  text: string;
  userId?: string | null;
  reqId?: string | null;
  date?: string | null;
}

/** 확인 기록은 고치지 않고 쌓기만 한다 — 증적이므로 */
export async function addNote(store: Store, actor: ActorFull, input: NoteInput): Promise<ServiceResult<MonitorNote>> {
  if (actor.role !== "ADMIN") return forbiddenR("관리자만 기록할 수 있습니다.");
  const text = (input.text ?? "").trim();
  if (!input.key || !text) return err(400, "EMPTY", "내용을 입력해 주세요.");
  if (!["OK", "ACTION", "MEMO"].includes(input.status)) return err(400, "BAD_STATUS", "판정을 골라 주세요.");
  const at = new Date().toISOString();
  const note: MonitorNote = {
    noteId: `N|${at}|${Math.random().toString(36).slice(2, 8)}`,
    key: input.key.slice(0, 150),
    status: input.status,
    method: (input.method ?? "").trim().slice(0, 30),
    contact: (input.contact ?? "").trim().slice(0, 60),
    text: text.slice(0, 2000),
    by: actor.userId,
    byNm: actor.userNm,
    at,
  };
  await store.meas.upsert([row("NOTE", note.noteId, { prjId: "-", reqId: input.reqId ?? null, workDt: isDate(input.date) ? input.date : kstDate(Date.now()), userId: input.userId ?? null }, note, "ADMIN", actor.userId)]);
  return okR(note);
}
