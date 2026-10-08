import { can, type Action, type ActorFull } from "../auth/permissions";
import { record } from "../history";
import { err, forbiddenR, notFoundR, okR, type ServiceResult } from "../result";
import type { MeasKind, MeasRow, Store } from "../store/types";
import type { Project } from "../types";
import type { ParseResult, ParseWarning } from "./csv";
import { normDate } from "./csv";
import { parseAiUsageCsv } from "./parsers/aiusageCsv";
import { parseCommitsCsv } from "./parsers/commitsCsv";
import { parseJiraCsv } from "./parsers/jiraCsv";
import { parseOtel } from "./parsers/otel";
import { getSettings, idOf, loadInput, SETTINGS_KEY, toRow } from "./repo";
import { PHASES, type AiLevel, type AiUse, type Defect, type Effort, type Feature, type MeasureSettings, type Phase } from "./types";

const now = () => new Date().toISOString();

async function measuringProject(store: Store, prjId: string): Promise<{ ok: true; p: Project } | { ok: false; r: ReturnType<typeof err> }> {
  const p = await store.projects.get(prjId);
  if (!p) return { ok: false, r: notFoundR("과제") };
  if (p.status !== "SELECTED") return { ok: false, r: err(409, "NOT_MEASURING", "선정된 과제만 측정 데이터를 입력할 수 있습니다.") };
  return { ok: true, p };
}

async function feature(store: Store, prjId: string, wbsId: string): Promise<Feature | null> {
  return (await loadInput(store, [prjId])).features.find((f) => f.wbsId === wbsId) ?? null;
}

export type FeatureInput = Omit<Feature, "prjId" | "devUserNm">;

export async function upsertFeature(store: Store, actor: ActorFull, prjId: string, input: FeatureInput, unit: "h" | "MD"): Promise<ServiceResult<Feature>> {
  const g = await measuringProject(store, prjId);
  if (!g.ok) return g.r;
  if (!can(actor, "measure.feature", { project: g.p })) return forbiddenR("기능 등록은 과제 PM 만 할 수 있습니다.");
  const wbsId = input.wbsId?.trim();
  if (!wbsId) return err(422, "VALIDATION", "WBS-ID 를 입력해 주세요.");
  if (!input.name?.trim()) return err(422, "VALIDATION", "기능명을 입력해 주세요.");
  const st = await getSettings(store);
  if (!st.featureTypes.some((t) => t.code === input.typeCd)) return err(422, "VALIDATION", "기능 유형을 선택해 주세요.");
  const mul = unit === "MD" ? st.mdHours : 1;
  const bl = input.baseline;
  const nums = [bl.DESIGN, bl.DEV, bl.UNIT, bl.INTEG, bl.defects];
  if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0)) return err(422, "VALIDATION", "기존 실적은 0 이상의 숫자여야 합니다.");
  let devUserNm: string | null = null;
  if (input.devUserId) {
    const u = await store.users.get(input.devUserId);
    if (!u || u.role !== "DEVELOPER") return err(422, "VALIDATION", "담당 개발자는 개발자 역할 계정이어야 합니다.");
    devUserNm = u.userNm;
  }
  if (input.completedAt && !normDate(input.completedAt)) return err(422, "VALIDATION", "완료일 형식이 올바르지 않습니다.");
  const prev = await feature(store, prjId, wbsId);
  const f: Feature = {
    prjId,
    wbsId,
    name: input.name.trim(),
    typeCd: input.typeCd,
    devUserId: input.devUserId || null,
    devUserNm,
    status: input.status,
    completedAt: input.status === "DONE" ? input.completedAt ?? null : null,
    baseline: { ...bl, DESIGN: bl.DESIGN * mul, DEV: bl.DEV * mul, UNIT: bl.UNIT * mul, INTEG: bl.INTEG * mul },
    note: input.note ?? "",
  };
  await store.meas.upsert([toRow("FEATURE", f, actor.userId, now())]);
  await record(store, actor, { targetTyp: "MEASURE", targetId: `${prjId}:${wbsId}`, actionCd: prev ? "UPDATE" : "CREATE", summary: `기능 ${prev ? "수정" : "등록"}: ${wbsId} ${f.name}`, diff: prev ? { before: prev.baseline, after: f.baseline } : null });
  return okR(f);
}

export async function deleteFeature(store: Store, actor: ActorFull, prjId: string, wbsId: string): Promise<ServiceResult<{ ok: true }>> {
  const g = await measuringProject(store, prjId);
  if (!g.ok) return g.r;
  if (!can(actor, "measure.feature", { project: g.p })) return forbiddenR();
  const input = await loadInput(store, [prjId]);
  if (input.efforts.some((e) => e.wbsId === wbsId)) return err(409, "IN_USE", "공수 기록이 있는 기능은 삭제할 수 없습니다.");
  const f = input.features.find((x) => x.wbsId === wbsId);
  if (!f) return notFoundR("기능");
  await store.meas.remove(idOf("FEATURE", f));
  await record(store, actor, { targetTyp: "MEASURE", targetId: `${prjId}:${wbsId}`, actionCd: "DELETE", summary: `기능 삭제: ${wbsId}` });
  return okR({ ok: true });
}

export interface TodayItem {
  prjId: string;
  wbsId: string;
  phase: Phase;
  hours: number;
  aiLevel: AiLevel | null;
}

export async function saveTodayEfforts(
  store: Store,
  actor: ActorFull,
  date: string,
  items: TodayItem[],
  completes: { prjId: string; wbsId: string }[],
): Promise<ServiceResult<{ saved: number; hours: number }>> {
  if (!normDate(date)) return err(422, "VALIDATION", "날짜 형식이 올바르지 않습니다.");
  const upserts: MeasRow[] = [];
  const removes: string[] = [];
  const t = now();
  const cache = new Map<string, { p: Project; f: Feature }>();

  async function ctx(prjId: string, wbsId: string) {
    const k = `${prjId}|${wbsId}`;
    if (cache.has(k)) return cache.get(k)!;
    const g = await measuringProject(store, prjId);
    if (!g.ok) return g.r;
    const f = await feature(store, prjId, wbsId);
    if (!f) return notFoundR(`기능 ${wbsId}`);
    if (!can(actor, "measure.effort", { project: g.p, feature: f })) return forbiddenR(`${wbsId} 의 담당 개발자만 입력할 수 있습니다.`);
    cache.set(k, { p: g.p, f });
    return cache.get(k)!;
  }

  for (const it of items) {
    if (!PHASES.includes(it.phase)) return err(422, "VALIDATION", "단계 값이 올바르지 않습니다.");
    if (typeof it.hours !== "number" || !Number.isFinite(it.hours) || it.hours < 0 || it.hours > 24) {
      return err(422, "VALIDATION", "투입시간은 0~24 시간 사이로 입력해 주세요.");
    }
    const c = await ctx(it.prjId, it.wbsId);
    if ("ok" in c && c.ok === false) return c;
    const e: Effort = { prjId: it.prjId, wbsId: it.wbsId, workDt: date, phase: it.phase, hours: Math.round(it.hours * 100) / 100, userId: actor.userId, aiLevel: it.aiLevel ?? null, memo: "", srcCd: "MANUAL" };
    if (e.hours === 0) removes.push(idOf("EFFORT", e));
    else upserts.push(toRow("EFFORT", e, actor.userId, t));
  }
  for (const cpl of completes) {
    const c = await ctx(cpl.prjId, cpl.wbsId);
    if ("ok" in c && c.ok === false) return c;
    const { f } = c as { f: Feature };
    upserts.push(toRow("FEATURE", { ...f, status: "DONE", completedAt: date }, actor.userId, t));
  }
  await store.meas.upsert(upserts);
  for (const id of removes) await store.meas.remove(id);
  const hours = items.reduce((s, i) => s + i.hours, 0);
  if (upserts.length || removes.length) {
    await record(store, actor, {
      targetTyp: "MEASURE",
      targetId: items[0]?.prjId ?? completes[0]?.prjId ?? "",
      actionCd: "EFFORT",
      summary: `공수 기록 ${date}: ${hours}h${completes.length ? `, 완료 ${completes.map((c) => c.wbsId).join(", ")}` : ""}`,
    });
  }
  return okR({ saved: upserts.length + removes.length, hours });
}

export async function setGridCell(
  store: Store,
  actor: ActorFull,
  prjId: string,
  wbsId: string,
  phase: Phase,
  targetHours: number,
  today: string,
): Promise<ServiceResult<{ adjustment: number }>> {
  if (typeof targetHours !== "number" || !Number.isFinite(targetHours) || targetHours < 0) return err(422, "VALIDATION", "0 이상의 숫자를 입력해 주세요.");
  const g = await measuringProject(store, prjId);
  if (!g.ok) return g.r;
  const input = await loadInput(store, [prjId]);
  const f = input.features.find((x) => x.wbsId === wbsId);
  if (!f) return notFoundR("기능");
  if (!can(actor, "measure.effort", { project: g.p, feature: f })) return forbiddenR("담당 개발자만 수정할 수 있습니다.");
  const todayGrid: Effort = { prjId, wbsId, workDt: today, phase, hours: 0, userId: actor.userId, aiLevel: null, memo: "공수 기록표에서 보정", srcCd: "GRID" };
  const gridId = idOf("EFFORT", todayGrid);
  // 일별 기록은 지우지 않고, 오늘자 보정 행 하나로 차이를 흡수한다 — 원천 기록과 보정 근거가 모두 남는다.
  const others = input.efforts.filter((e) => e.wbsId === wbsId && e.phase === phase && idOf("EFFORT", e) !== gridId).reduce((s, e) => s + e.hours, 0);
  const adjustment = Math.round((targetHours - others) * 100) / 100;
  if (adjustment === 0) await store.meas.remove(gridId);
  else await store.meas.upsert([toRow("EFFORT", { ...todayGrid, hours: adjustment }, actor.userId, now())]);
  await record(store, actor, { targetTyp: "MEASURE", targetId: `${prjId}:${wbsId}`, actionCd: "GRID", summary: `공수 기록표 보정 ${wbsId} ${phase}: 합계 ${targetHours}h (보정 ${adjustment > 0 ? "+" : ""}${adjustment}h)` });
  return okR({ adjustment });
}

export type DefectInput = Omit<Defect, "prjId" | "srcCd">;

export async function addDefect(store: Store, actor: ActorFull, prjId: string, d: DefectInput): Promise<ServiceResult<Defect>> {
  const g = await measuringProject(store, prjId);
  if (!g.ok) return g.r;
  if (!can(actor, "measure.defect", { project: g.p })) return forbiddenR("결함 등록은 테스트 수행자가 합니다.");
  if (!d.defectId?.trim() || !d.title?.trim()) return err(422, "VALIDATION", "결함 ID 와 제목을 입력해 주세요.");
  if (!normDate(d.foundDt)) return err(422, "VALIDATION", "발견일 형식이 올바르지 않습니다.");
  if (!(await feature(store, prjId, d.wbsId))) return err(422, "VALIDATION", `기능 목록에 없는 WBS-ID 입니다: ${d.wbsId}`);
  const row: Defect = { ...d, prjId, defectId: d.defectId.trim(), title: d.title.trim(), srcCd: "MANUAL" };
  await store.meas.upsert([toRow("DEFECT", row, actor.userId, now())]);
  await record(store, actor, { targetTyp: "MEASURE", targetId: `${prjId}:${d.wbsId}`, actionCd: "DEFECT", summary: `결함 등록 ${row.defectId}: ${row.title}` });
  return okR(row);
}

export async function removeDefect(store: Store, actor: ActorFull, prjId: string, defectId: string): Promise<ServiceResult<{ ok: true }>> {
  const g = await measuringProject(store, prjId);
  if (!g.ok) return g.r;
  if (!can(actor, "measure.defect", { project: g.p })) return forbiddenR();
  const d = (await loadInput(store, [prjId])).defects.find((x) => x.defectId === defectId);
  if (!d) return notFoundR("결함");
  await store.meas.remove(idOf("DEFECT", d));
  await record(store, actor, { targetTyp: "MEASURE", targetId: `${prjId}:${d.wbsId}`, actionCd: "DEFECT_DELETE", summary: `결함 삭제 ${defectId}` });
  return okR({ ok: true });
}

export async function addManualUsage(store: Store, actor: ActorFull, prjId: string, u: Omit<AiUse, "prjId" | "srcCd" | "reportedCost">): Promise<ServiceResult<AiUse>> {
  const g = await measuringProject(store, prjId);
  if (!g.ok) return g.r;
  if (!can(actor, "measure.upload.usage", { project: g.p })) return forbiddenR();
  if (actor.role === "DEVELOPER" && u.userId !== actor.userId) return forbiddenR("본인 사용량만 입력할 수 있습니다.");
  if (!normDate(u.workDt) || !u.model?.trim()) return err(422, "VALIDATION", "일자와 모델을 입력해 주세요.");
  const nums = [u.requests, u.inputTokens, u.outputTokens, u.cacheReadTokens, u.cacheWriteTokens];
  if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0)) return err(422, "VALIDATION", "수치는 0 이상이어야 합니다.");
  const row: AiUse = { ...u, prjId, model: u.model.trim(), reportedCost: null, srcCd: "MANUAL" };
  await store.meas.upsert([toRow("AIUSE", row, actor.userId, now())]);
  await record(store, actor, { targetTyp: "UPLOAD", targetId: prjId, actionCd: "MANUAL_USAGE", summary: `AI 사용량 수기 입력 ${u.workDt} ${u.model} ${u.requests}건` });
  return okR(row);
}

export type UploadKind = "usage" | "otel" | "commits" | "jira";

const UPLOAD_ACTION: Record<UploadKind, Action> = { usage: "measure.upload.usage", otel: "measure.upload.usage", commits: "measure.upload.commit", jira: "measure.defect" };
const UPLOAD_LABEL: Record<UploadKind, string> = { usage: "AI 사용량(로컬 로그)", otel: "AI 사용량(OTel)", commits: "커밋", jira: "Jira 결함" };
const UPLOAD_KIND: Record<UploadKind, MeasKind> = { usage: "AIUSE", otel: "AIUSE", commits: "COMMIT", jira: "DEFECT" };

export interface UploadResult {
  inserted: number;
  updated: number;
  warnings: ParseWarning[];
  preview: unknown[];
}

export async function applyUpload(
  store: Store,
  actor: ActorFull,
  prjId: string,
  kind: UploadKind,
  fileName: string,
  text: string,
  dryRun: boolean,
): Promise<ServiceResult<UploadResult>> {
  const g = await measuringProject(store, prjId);
  if (!g.ok) return g.r;
  if (!can(actor, UPLOAD_ACTION[kind], { project: g.p })) return forbiddenR(`${UPLOAD_LABEL[kind]} 업로드 권한이 없습니다.`);
  if (text.length > 20 * 1024 * 1024) return err(413, "TOO_LARGE", "파일이 너무 큽니다(20MB 이하).");
  const st: MeasureSettings = await getSettings(store);
  const ctx = { prjId, wbsPattern: st.wbsPattern };

  let parsed: ParseResult<unknown>;
  if (kind === "usage") parsed = parseAiUsageCsv(text, ctx);
  else if (kind === "otel") parsed = parseOtel(text, { ...ctx, fileName });
  else if (kind === "commits") parsed = parseCommitsCsv(text, ctx);
  else {
    const mapping = st.jiraMappings[prjId];
    if (!mapping) return err(422, "NO_MAPPING", "Jira 열 매핑을 먼저 지정해 주세요.");
    parsed = parseJiraCsv(text, { ...ctx, mapping });
  }

  let rows = parsed.rows;
  const warnings = [...parsed.warnings];
  // 개발자가 다른 사람 사용량을 올려 실적을 바꾸지 못하게 본인 행만 받는다.
  if ((kind === "usage" || kind === "otel") && actor.role === "DEVELOPER") {
    const others = (rows as AiUse[]).filter((u) => u.userId !== actor.userId);
    for (const u of others) warnings.push({ line: 0, message: `${u.userId} 의 사용량은 본인 것이 아니어서 제외했습니다.` });
    rows = (rows as AiUse[]).filter((u) => u.userId === actor.userId);
  }

  const mk = UPLOAD_KIND[kind];
  const existing = new Set((await store.meas.list(prjId, mk)).map((r) => r.datId));
  const t = now();
  const measRows = rows.map((r) => toRow(mk, r as never, actor.userId, t));
  const updated = measRows.filter((r) => existing.has(r.datId)).length;
  const result: UploadResult = { inserted: measRows.length - updated, updated, warnings: warnings.slice(0, 200), preview: rows.slice(0, 20) };
  if (dryRun) return okR(result);

  await store.meas.upsert(measRows);
  await record(store, actor, {
    targetTyp: "UPLOAD",
    targetId: prjId,
    actionCd: kind.toUpperCase(),
    summary: `${UPLOAD_LABEL[kind]} ${measRows.length}건 (신규 ${result.inserted}, 갱신 ${updated}${warnings.length ? `, 경고 ${warnings.length}` : ""}) · ${fileName}`,
  });
  return okR(result);
}

export async function saveSettings(store: Store, actor: ActorFull, s: MeasureSettings): Promise<ServiceResult<MeasureSettings>> {
  if (!can(actor, "measure.settings")) return forbiddenR();
  const nonNeg = [s.laborRatePerHour, s.postFixDays, s.crossCheckToleranceDays, s.idleAlertDays, s.mdHours, s.sizeBands?.S, s.sizeBands?.M, s.sizeBands?.L];
  if (nonNeg.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0)) return err(422, "VALIDATION", "수치 설정은 0 이상이어야 합니다.");
  if (!(s.sizeBands.S < s.sizeBands.M && s.sizeBands.M < s.sizeBands.L)) return err(422, "VALIDATION", "규모 구간은 S < M < L 순서여야 합니다.");
  if (s.mdHours <= 0) return err(422, "VALIDATION", "MD 환산 시간은 0보다 커야 합니다.");
  try {
    new RegExp(s.wbsPattern);
  } catch {
    return err(422, "VALIDATION", "WBS 정규식이 올바르지 않습니다.");
  }
  if (!s.featureTypes?.length || s.featureTypes.some((t) => !t.code?.trim() || !t.label?.trim())) return err(422, "VALIDATION", "기능 유형 코드·이름을 확인해 주세요.");
  if (s.tokenPrices.some((p) => !p.model?.trim() || [p.input, p.output, p.cacheRead, p.cacheWrite].some((n) => typeof n !== "number" || n < 0))) {
    return err(422, "VALIDATION", "모델 단가를 확인해 주세요.");
  }
  const prev = await store.config.get<MeasureSettings>(SETTINGS_KEY);
  // 관리자가 한 번 저장하면 예시 단가가 아니라 확정한 값으로 본다.
  const next: MeasureSettings = { ...s, sampleValues: false };
  await store.config.set(SETTINGS_KEY, next, (prev?.verNo ?? 0) + 1, actor.userId);
  await record(store, actor, { targetTyp: "MEASURE", targetId: "SETTINGS", actionCd: "SETTINGS", summary: "측정 설정 변경", diff: { before: prev?.value ?? null, after: next } });
  return okR(next);
}

export async function saveJiraMapping(store: Store, actor: ActorFull, prjId: string, mapping: MeasureSettings["jiraMappings"][string]): Promise<ServiceResult<true>> {
  const g = await measuringProject(store, prjId);
  if (!g.ok) return g.r;
  if (!can(actor, "measure.defect", { project: g.p })) return forbiddenR();
  const st = await getSettings(store);
  const prev = await store.config.get<MeasureSettings>(SETTINGS_KEY);
  await store.config.set(SETTINGS_KEY, { ...st, jiraMappings: { ...st.jiraMappings, [prjId]: mapping } }, (prev?.verNo ?? 0) + 1, actor.userId);
  return okR(true);
}
