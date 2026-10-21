import { can, type ActorFull } from "../auth/permissions";
import { record } from "../history";
import { err, forbiddenR, notFoundR, okR, type ServiceResult } from "../result";
import type { MeasRow, Store } from "../store/types";
import type { Project, UserRecord } from "../types";
import { normalizeSettings, SETTINGS_KEY } from "./defaults";
import { activeMinutes, addTokens, kstDate, kstTime, parseLogUpload, type OtelEvent } from "./ingest";
import type { StoredSession } from "./match";
import { buildIndex, cellOf, confKey, dayState, daySnap, rowsOf, type Index, type MeasureData } from "./metrics";
import { ACT_TYPES, type ActType, type AiSession, type DayConf, type EffortEntry, type MonitorNote, type NoteStatus, type Settings } from "./types";
import { isHHMM, overlaps, spanMin, toMin, type EffortSpan } from "./spans";
import { reqDone, reqKey } from "./units";
import type { Actor } from "../auth/permissions";
import { writeSheets, type OutTable } from "../projects/workbook";
import { STAGE_LABEL } from "../types";
import { dashView, type DashFilter } from "../views";
import type { Agg } from "./metrics";

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
const confId = (userId: string, rk: string, date: string) => `C|${userId}|${rk}|${date}`;
export const sessionId = (src: string, sid: string, date: string) => `A|${src}|${sid}|${date}`;

function row(kind: MeasRow["kind"], datId: string, base: { prjId: string; reqId: string | null; workDt: string; userId: string | null }, data: unknown, src: string, by: string): MeasRow {
  const now = new Date().toISOString();
  return { datId, kind, prjId: base.prjId, reqId: base.reqId, workDt: base.workDt, userId: base.userId, srcCd: src, data, regUserId: by, regAt: now, updAt: now };
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const round1 = (v: number) => Math.round(v * 10) / 10;
// 입력은 10분 단위라 0.1시간으로 반올림하면 10분이 12분이 된다 — 분으로 맞춘다.
const roundMin = (v: number) => Math.round(v * 60) / 60;

export interface EffortInput {
  unit: string;
  date: string;
  /** AI 도구 내 시간(h) — 수집값 이하로만. 없으면 그대로 */
  inT?: number;
  add?: Partial<Record<ActType, number>>;
  /** 직접 입력 시간대 — 주면 add 대신 이것으로 유형별 합계를 만든다 */
  spans?: EffortSpan[];
  /** 시간대 없이 넣었던 이전 값 중 남겨 둘 것(h) */
  untimed?: Partial<Record<ActType, number>>;
  memo?: string;
}

export async function saveEffort(store: Store, actor: ActorFull, input: EffortInput): Promise<ServiceResult<null>> {
  const ix = await loadIndex(store);
  const u = ix.unitByCode.get(input.unit);
  if (!u) return notFoundR("단계");
  if (!can(actor, "effort.edit", { ownerId: u.ownerId })) return forbiddenR("내 담당 단계만 입력할 수 있습니다.");
  if (!isDate(input.date) || input.date > todayKst()) return err(400, "BAD_DATE", "오늘 이후 날짜는 입력할 수 없습니다.");
  if (u.s.done) return err(409, "DONE", "측정 완료된 단계입니다.");
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
    spans: prev?.spans,
    memo: prev?.memo ?? "",
  };
  if (input.inT !== undefined) {
    const v = roundMin(Number(input.inT));
    if (!Number.isFinite(v) || v < 0) return err(400, "BAD_VALUE", "AI 도구 내 시간은 0 이상이어야 합니다.");
    if (v > roundMin(cur.ai)) return err(400, "OVER_COLLECTED", `수집값 ${round1(cur.ai)}h 보다 크게 넣을 수 없습니다. 수집되지 않은 AI 사용은 A7 로 넣어 주세요.`);
    next.reduceH = Math.max(0, cur.ai - v);
  }
  if (input.spans !== undefined) {
    const r = checkSpans(ix, actor.userId, u.code, input.date, input.spans);
    if (!r.ok) return r;
    const add: Partial<Record<ActType, number>> = {};
    for (const t of ACT_TYPES) {
      const keep = roundMin(Number(input.untimed?.[t.cd] ?? 0));
      if (!Number.isFinite(keep) || keep < 0) return err(400, "BAD_VALUE", `${t.label} 시간이 올바르지 않습니다.`);
      // 시간대 없는 이전 값은 줄이거나 지우기만 — 시간대 없이 새로 늘리지 못하게.
      const had = Math.max(0, (prev?.add[t.cd] ?? 0) - (prev?.spans ?? []).filter((x) => x.type === t.cd).reduce((a, x) => a + spanMin(x) / 60, 0));
      const v = r.value.filter((x) => x.type === t.cd).reduce((a, x) => a + spanMin(x), 0) / 60 + Math.min(keep, roundMin(had));
      if (v > 0) add[t.cd] = roundMin(v);
    }
    next.add = add;
    next.spans = r.value;
    next.memo = (input.memo ?? "").trim().slice(0, 200);
    if (add.A8 && !next.memo) return err(400, "MEMO_REQUIRED", "A8 기타는 메모를 적어 주세요.");
  } else if (input.add !== undefined) {
    const add: Partial<Record<ActType, number>> = {};
    for (const t of ACT_TYPES) {
      const v = roundMin(Number(input.add[t.cd] ?? 0));
      if (!Number.isFinite(v) || v < 0) return err(400, "BAD_VALUE", `${t.label} 시간이 올바르지 않습니다.`);
      if (v > 0) add[t.cd] = v;
    }
    next.add = add;
    // 합계만 바꾸면 시간대와 맞지 않으므로 시간대를 버린다.
    next.spans = undefined;
    next.memo = (input.memo ?? "").trim().slice(0, 200);
    if (add.A8 && !next.memo) return err(400, "MEMO_REQUIRED", "A8 기타는 메모를 적어 주세요.");
  }
  const total = cur.ai - Math.min(cur.ai, next.reduceH) + Object.values(next.add).reduce((a, b) => a + (b ?? 0), 0);
  if (total > 16) return err(400, "TOO_MANY", "한 단계 하루 투입이 16시간을 넘습니다. 값을 확인해 주세요.");

  await store.meas.upsert([row("EFFORT", effortId(u.code, input.date), { ...next, reqId: u.reqId }, next, "MANUAL", actor.userId)]);
  return okR(null);
}

/** 시간대 검증 — 한 사람이 같은 시각에 직접 한 일을 두 군데 적으면 공수가 두 번 잡히므로 다른 단계 입력과도 겹치지 않게 */
function checkSpans(ix: Index, userId: string, unit: string, date: string, raw: unknown): ServiceResult<EffortSpan[]> {
  if (!Array.isArray(raw) || raw.length > 50) return err(400, "BAD_VALUE", "시간대 형식이 올바르지 않습니다.");
  const types = new Set(ACT_TYPES.map((t) => t.cd));
  const spans: EffortSpan[] = [];
  for (const x of raw as Partial<EffortSpan>[]) {
    if (!x || !types.has(x.type as ActType) || !isHHMM(x.start) || !isHHMM(x.end)) return err(400, "BAD_VALUE", "시간대 형식이 올바르지 않습니다.");
    if (toMin(x.end) <= toMin(x.start)) return err(400, "BAD_SPAN", `${x.start}~${x.end}: 끝 시각이 시작보다 늦어야 합니다.`);
    spans.push({ type: x.type as ActType, start: x.start, end: x.end });
  }
  spans.sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < spans.length; i++)
    if (overlaps(spans[i - 1], spans[i])) return err(400, "SPAN_OVERLAP", `${spans[i - 1].start}~${spans[i - 1].end} 와 ${spans[i].start}~${spans[i].end} 가 겹칩니다.`);
  for (const e of Array.from(ix.effort.values())) {
    if (e.userId !== userId || e.workDt !== date || e.unit === unit) continue;
    const o = (e.spans ?? []).find((y) => spans.some((x) => overlaps(x, y)));
    if (o) return err(400, "SPAN_OVERLAP", `${o.start}~${o.end} 는 이미 ${e.unit} 에 직접 입력한 시간입니다.`);
  }
  return okR(spans);
}

/** rk = 과제ID-요구사항ID */
function findReq(projects: Project[], rk: string) {
  for (const p of projects) {
    const r = p.reqs.find((x) => reqKey(p.prjId, x.reqId) === rk);
    if (r) return { prj: p, req: r };
  }
  return null;
}

/** 확정 — dates 를 안 주면 확정 필요한 날 전부 */
export async function confirmDays(store: Store, actor: ActorFull, rk: string, dates?: string[]): Promise<ServiceResult<{ count: number }>> {
  const ix = await loadIndex(store);
  const f = findReq(ix.data.projects, rk);
  if (!f) return notFoundR("요구사항");
  if (!can(actor, "effort.edit", { req: f.req })) return forbiddenR("내 담당 요구사항만 확정할 수 있습니다.");
  return okR({ count: await confirmRows(store, actor, ix, [{ prj: f.prj, req: f.req, dates }]) });
}

/** 하루 확정 — 그날 기록이 있는 내 요구사항을 한 번에 */
export async function confirmDate(store: Store, actor: ActorFull, date: string): Promise<ServiceResult<{ count: number }>> {
  if (!can(actor, "effort.edit", { ownerId: actor.userId })) return forbiddenR("본인 공수만 확정할 수 있습니다.");
  if (!isDate(date)) return err(400, "BAD_DATE", "날짜가 올바르지 않습니다.");
  const ix = await loadIndex(store);
  const targets = ix.data.projects.flatMap((prj) => prj.reqs.filter((req) => can(actor, "effort.edit", { req })).map((req) => ({ prj, req, dates: [date] })));
  return okR({ count: await confirmRows(store, actor, ix, targets) });
}

async function confirmRows(store: Store, actor: ActorFull, ix: Index, targets: { prj: Project; req: Project["reqs"][number]; dates?: string[] }[]): Promise<number> {
  const now = new Date().toISOString();
  const out: MeasRow[] = [];
  const again: string[] = [];
  for (const { prj, req, dates } of targets) {
    const rk = reqKey(prj.prjId, req.reqId);
    const rows = rowsOf(ix, actor.userId, req).filter((r) => r.st !== "conf" && (!dates || dates.includes(r.date)));
    for (const r of rows) {
      const prev = ix.conf.get(confKey(actor.userId, rk, r.date));
      const reconfirm = !!prev && (prev.state === "EDIT" || prev.state === "CONF");
      const c: DayConf = {
        userId: actor.userId,
        prjId: prj.prjId,
        reqId: req.reqId,
        workDt: r.date,
        state: "CONF",
        confirmedAt: now,
        firstConfirmedAt: prev?.firstConfirmedAt ?? prev?.confirmedAt ?? now,
        revCount: (prev?.revCount ?? 0) + (reconfirm ? 1 : 0),
        snap: daySnap(ix, actor.userId, req, r.date),
      };
      out.push(row("CONF", confId(actor.userId, rk, r.date), { prjId: prj.prjId, reqId: req.reqId, workDt: r.date, userId: actor.userId }, c, "MANUAL", actor.userId));
    }
    if (rows.some((r) => r.revCount > 0 || r.st === "edit")) again.push(`${rk} ${rows.map((r) => r.date).join(", ")}`);
  }
  if (out.length) await store.meas.upsert(out);
  for (const a of again) await record(store, actor, { targetTyp: "EFFORT", targetId: a.split(" ")[0], actionCd: "RECONFIRM", summary: `${a} 다시 확정` });
  return out.length;
}

async function setConfState(store: Store, actor: ActorFull, rk: string, date: string, state: "EDIT" | "EXTRA"): Promise<ServiceResult<null>> {
  const ix = await loadIndex(store);
  const f = findReq(ix.data.projects, rk);
  if (!f) return notFoundR("요구사항");
  if (!can(actor, "effort.edit", { req: f.req })) return forbiddenR("내 담당 요구사항만 고칠 수 있습니다.");
  if (!isDate(date) || date > todayKst()) return err(400, "BAD_DATE", "오늘 이후 날짜는 고를 수 없습니다.");
  const prev = ix.conf.get(confKey(actor.userId, rk, date));
  if (state === "EXTRA" && (prev || rowsOf(ix, actor.userId, f.req).some((r) => r.date === date)))
    return err(409, "EXISTS", "이미 입력 줄이 있는 날입니다.");
  if (state === "EDIT" && prev?.state !== "CONF") return err(409, "NOT_CONFIRMED", "확정된 날이 아닙니다.");
  const c: DayConf = {
    userId: actor.userId,
    prjId: f.prj.prjId,
    reqId: f.req.reqId,
    workDt: date,
    state,
    confirmedAt: prev?.confirmedAt ?? null,
    firstConfirmedAt: prev?.firstConfirmedAt ?? prev?.confirmedAt ?? null,
    revCount: prev?.revCount ?? 0,
    snap: prev?.snap ?? {},
  };
  await store.meas.upsert([row("CONF", confId(actor.userId, rk, date), { prjId: f.prj.prjId, reqId: f.req.reqId, workDt: date, userId: actor.userId }, c, "MANUAL", actor.userId)]);
  if (state === "EDIT") await record(store, actor, { targetTyp: "EFFORT", targetId: rk, actionCd: "UNCONFIRM", summary: `${rk} ${date} 확정 해제(수정)`, diff: { before: prev?.snap } });
  return okR(null);
}

export const reopenDay = (store: Store, actor: ActorFull, rk: string, date: string) => setConfState(store, actor, rk, date, "EDIT");
export const addExtraDay = (store: Store, actor: ActorFull, rk: string, date: string) => setConfState(store, actor, rk, date, "EXTRA");

export type ResolveInput = { off: true } | { reset: true } | { parts: { unit: string; min: number }[] };

export async function resolveSession(store: Store, actor: ActorFull, datId: string, input: ResolveInput): Promise<ServiceResult<null>> {
  const r = await store.meas.get(datId);
  if (!r || r.kind !== "AIUSE") return notFoundR("AI 사용 기록");
  const s = r.data as AiSession;
  if (actor.role !== "DEVELOPER" || s.userId !== actor.userId) return forbiddenR("본인 AI 사용만 처리할 수 있습니다.");
  const at = new Date().toISOString();
  if ("reset" in input) {
    // 직접 처리를 지우면 다시 공수 태그로 매칭되고, 안 맞으면 미분류로 돌아간다.
    if (!s.resolution) return err(409, "NOT_RESOLVED", "직접 처리한 세션이 아닙니다.");
    s.resolution = null;
  } else if ("off" in input) {
    s.resolution = { kind: "OFF", by: actor.userId, at };
  } else {
    const ix = await loadIndex(store);
    const parts = (input.parts ?? []).map((p) => ({ unit: p.unit, min: Math.round(Number(p.min)) })).filter((p) => p.min > 0);
    if (parts.length === 0) return err(400, "EMPTY", "배정할 시간을 넣어 주세요.");
    const sum = parts.reduce((a, p) => a + p.min, 0);
    if (sum > Math.ceil(s.minutes)) return err(400, "OVER", `${Math.ceil(s.minutes)}분을 넘을 수 없습니다.`);
    for (const p of parts) {
      const u = ix.unitByCode.get(p.unit);
      if (!u || u.ownerId !== actor.userId) return err(400, "NOT_MINE", `${p.unit} 은(는) 내 담당 단계가 아닙니다.`);
      if (u.s.done) return err(400, "DONE", `${p.unit} 은(는) 측정 완료된 단계입니다.`);
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

/** 이벤트의 계정 후보 → 포털 사번. 'AI 도구 계정'이 맞으면 그 사람, 없으면 사번·이메일 앞부분이 같은 계정 */
export function userForAccounts(users: UserRecord[], accounts: string[]): string | null {
  const low = accounts.map((a) => a.trim().toLowerCase());
  const byAcct = users.find((u) => u.aiAcct && low.includes(u.aiAcct.trim().toLowerCase()));
  if (byAcct) return byAcct.userId;
  return users.find((u) => low.some((a) => a === u.userId.toLowerCase() || a.split("@")[0] === u.userId.toLowerCase()))?.userId ?? null;
}

/**
 * 텔레메트리 수신 — Codex 이벤트를 세션·일자 행에 쌓는다. 활동 시간은 앞 묶음의 마지막 이벤트 시각에서 이어 계산한다.
 * 동시 수신 시 같은 행을 겹쳐 쓸 수 있으나 PoC 규모(개발자 수십 명)에선 수용.
 */
export async function ingestOtel(store: Store, events: OtelEvent[]): Promise<number> {
  if (events.length === 0) return 0;
  const users = (await store.users.list()).filter((u) => u.useYn);
  const grouped = new Map<string, { userId: string; list: OtelEvent[] }>();
  for (const e of events) {
    const userId = userForAccounts(users, e.accounts);
    if (!userId) continue;
    const id = sessionId("OTEL", e.sessionId, e.workDt);
    const g = grouped.get(id) ?? { userId, list: [] };
    g.list.push(e);
    grouped.set(id, g);
  }
  const rows: MeasRow[] = [];
  for (const [id, { userId, list }] of Array.from(grouped)) {
    const prev = (await store.meas.get(id))?.data as AiSession | undefined;
    const first = list[0];
    const times = list.map((d) => d.ms);
    let tokens = prev?.tokens;
    for (const e of list) if (e.tokens) tokens = addTokens(tokens, e.model || "unknown", e.tokens);
    const lastMs = Math.max(prev?.lastMs ?? 0, ...times);
    const s: AiSession = {
      src: "OTEL",
      sessionId: first.sessionId,
      userId,
      workDt: first.workDt,
      tool: first.tool,
      minutes: Math.round(((prev?.minutes ?? 0) + activeMinutes(times, prev?.lastMs)) * 100) / 100,
      start: prev?.start || kstTime(Math.min(...times)),
      end: kstTime(lastMs),
      branch: prev?.branch ?? "",
      hints: Array.from(new Set([...(prev?.hints ?? []), ...list.flatMap((d) => d.hints)])).slice(0, 20),
      resolution: prev?.resolution ?? null,
      tokens,
      lastMs,
    };
    rows.push(row("AIUSE", id, { prjId: "-", reqId: null, workDt: s.workDt, userId: s.userId }, s, "OTEL", "otel"));
  }
  await store.meas.upsert(rows);
  return rows.length;
}

export async function saveSettings(store: Store, actor: ActorFull, v: Settings): Promise<ServiceResult<Settings>> {
  if (!can(actor, "settings.manage")) return forbiddenR();
  if (!isHHMM(v.workStart) || !isHHMM(v.workEnd) || toMin(v.workStart) >= toMin(v.workEnd)) return err(400, "BAD_VALUE", "기본 근무시간은 시작이 끝보다 빠른 HH:MM 이어야 합니다.");
  const s = normalizeSettings(v);
  if (!isDate(s.measureStart)) return err(400, "BAD_DATE", "측정 시작일 형식이 올바르지 않습니다.");
  if (!(s.mdHours > 0)) return err(400, "BAD_VALUE", "1 M/D 시간은 0 보다 커야 합니다.");
  const prices = [...Object.values(s.gradePrice), ...Object.values(s.gradePriceMm), ...Object.values(s.tokenPrice).flatMap((p) => [p.input, p.cached, p.output])];
  if (prices.some((x) => !(x >= 0))) return err(400, "BAD_VALUE", "단가는 0 이상 숫자여야 합니다.");
  const prev = await store.config.get<Settings>(SETTINGS_KEY);
  await store.config.set(SETTINGS_KEY, s, (prev?.verNo ?? 0) + 1, actor.userId);
  await record(store, actor, { targetTyp: "SETTINGS", targetId: SETTINGS_KEY, actionCd: "UPDATE", summary: "기준정보(단가·토큰 단가·업무 유형) 변경", diff: { before: prev?.value, after: s } });
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

// ---------- 측정 결과 내려받기 ----------

const AGG_HEAD = [
  "단계 수",
  "기준 공수 (M/D)",
  "실제 공수 (M/D)",
  "공수 절감률 (%)",
  "절감 공수 (M/D)",
  "기준 인건비 (원)",
  "실제 인건비 (원)",
  "AI 비용 (원)",
  "비용 순절감률 (%)",
  "순절감액 (원)",
  "AI 사용 (h)",
  "AI 없이 (h)",
  "AI 활용률 (%)",
  ...ACT_TYPES.map((t) => `AI 없이 · ${t.label} (h)`),
];
const r2n = (v: number) => Math.round(v * 100) / 100;
const pctN = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 10);
const aggCols = (a: Agg): (number | null)[] => [
  a.unitN,
  r2n(a.baseMd),
  r2n(a.md),
  pctN(a.save),
  r2n(a.saveMd),
  Math.round(a.baseCost),
  Math.round(a.labor),
  Math.round(a.aiCost),
  pctN(a.net),
  Math.round(a.netAmt),
  r2n(a.inT),
  r2n(a.out),
  pctN(a.use),
  ...ACT_TYPES.map((t) => r2n(a.byType[t.cd] ?? 0)),
];

/** 측정 결과 화면의 집계를 엑셀로 — 보는 사람마다 다른 관점으로 다시 묶어 볼 수 있게 화면과 같은 숫자를 내보낸다 */
export async function exportResult(store: Store, actor: Actor, filter: DashFilter): Promise<ServiceResult<ArrayBuffer>> {
  const vm = dashView(await loadIndex(store), actor, filter, new Date().toISOString());
  const t = (head: string[], rows: (string | number | null)[][], title?: string): OutTable => ({ title, head: [...head, ...AGG_HEAD], rows });
  const sheets: { name: string; tables: OutTable[] }[] = [
    { name: "과제별", tables: [t(["과제 ID", "과제명"], [...vm.projects.map((p) => [p.prjId, p.prjNm, ...aggCols(p.agg)]), ["합계", "", ...aggCols(vm.total)]])] },
    {
      name: "SDLC 단계별",
      tables: [
        t(["단계", "업무 유형"], vm.stages.flatMap((x) => [[STAGE_LABEL[x.cd], "전체", ...aggCols(x.agg)], ...(x.workTypes.length > 1 ? x.workTypes.map((w) => [STAGE_LABEL[x.cd], w.workType, ...aggCols(w.agg)]) : [])])),
      ],
    },
    { name: "요구사항별", tables: [t(["과제 ID", "과제명", "요구사항 ID", "요구사항"], vm.reqs.map((r) => [r.prjId, r.prjNm, r.reqId, r.name || null, ...aggCols(r.agg)]))] },
    {
      name: "요구사항×단계",
      tables: [
        t(
          ["과제 ID", "과제명", "요구사항 ID", "요구사항", "단계", "담당"],
          vm.matrix.flatMap((m) =>
            Object.entries(m.cells).flatMap(([cd, c]) => (c?.agg ? [[m.prjId, m.prjNm, m.reqId, m.name || null, STAGE_LABEL[cd as keyof typeof STAGE_LABEL], c.ownerNm, ...aggCols(c.agg)]] : [])),
          ),
        ),
      ],
    },
    { name: "과제 성격별", tables: vm.byDim.map((d) => t(["분류 축", "분류"], d.rows.map((r) => [d.title, r.cat, ...aggCols(r.agg)]), d.title)) },
    {
      name: "기준",
      tables: [
        {
          head: ["항목", "값"],
          rows: [
            ["범위", `${vm.filter.prjId ? (vm.projectOptions.find((p) => p.prjId === vm.filter.prjId)?.prjNm ?? vm.filter.prjId) : "과제 전체"} · ${vm.filter.includeIng ? "측정 완료 + 측정 중" : "측정 완료"}`],
            ["집계", "개발자가 확정한 날만"],
            ["1 M/D", `${vm.settings.mdHours}시간`],
            ["내려받은 시각", new Date().toISOString()],
          ],
        },
        { title: "지표 정의", head: ["구분", "지표", "계산", "비고"], rows: vm.metrics.map((m) => [m.group, m.name, m.formula, m.note || null]) },
      ],
    },
  ];
  return okR(await writeSheets(sheets));
}
