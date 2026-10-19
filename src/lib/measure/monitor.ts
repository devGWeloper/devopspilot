// 공수 입력 이상 감지 — 숫자를 새로 계산하지 않고 metrics.ts 의 셀·집계 결과를 규칙으로 걸러 낸다.
import { aggTrace, cellOf, dayState, traceUnits, type Index } from "./metrics";
import { STAGE_LABEL } from "../types";
import { reqDone, reqKey } from "./units";
import type { Anomaly, Severity } from "./monitorRules";

export type { Anomaly, RuleCd, Severity } from "./monitorRules";

// 기준값 — 2개월 PoC 동안 바꿀 일이 드물어 설정 화면에 두지 않는다.
const MAX_DAY_H = 12;
const SAME_MIN_DAYS = 4;
const BULK_MIN_DAYS = 4;
const REDUCE_SHARE = 0.5;
const SPIKE_RATIO = 2;
const SPIKE_MIN_DAYS = 5;
const OVER_BASE = 1.5;
const TOO_GOOD = 0.8;
const LATE_DAYS = 5;
const PENDING_DAYS = 3;

const r1 = (v: number) => Math.round(v * 10) / 10;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function detectAnomalies(ix: Index, names: Map<string, string>, today: string): Anomaly[] {
  const out: Anomaly[] = [];
  const nm = (id: string | null) => (id ? (names.get(id) ?? id) : "미지정");
  const owners = Array.from(new Set(ix.units.map((u) => u.ownerId).filter((x): x is string => !!x)));

  for (const userId of owners) {
    const mine = ix.units.filter((u) => u.ownerId === userId);
    const dates = new Set<string>();
    mine.forEach((u) => ix.daysByUnit.get(u.code)?.forEach((d) => dates.add(d)));
    const daily = Array.from(dates)
      .sort()
      .map((date) => ({ date, h: r1(mine.reduce((a, u) => a + cellOf(ix, u.code, date).tot, 0)) }))
      .filter((d) => d.h > 0);

    // 같은 시간 반복
    const byH = new Map<number, string[]>();
    daily.forEach((d) => byH.set(d.h, [...(byH.get(d.h) ?? []), d.date]));
    byH.forEach((ds, h) => {
      if (ds.length >= SAME_MIN_DAYS && ds.length / daily.length >= 0.6)
        out.push({
          key: `SAME_HOURS|${userId}|${h}`,
          rule: "SAME_HOURS",
          severity: "mid",
          userId,
          reqId: null,
          date: ds[ds.length - 1],
          title: `${nm(userId)} — ${ds.length}일 모두 하루 ${h}h`,
          detail: `입력한 ${daily.length}일 중 ${ds.length}일이 정확히 ${h}h 입니다. (${ds.slice(-5).join(", ")}${ds.length > 5 ? " …" : ""})`,
        });
    });

    // 하루 과다, 평소와 다른 날
    const avg = daily.length ? daily.reduce((a, d) => a + d.h, 0) / daily.length : 0;
    for (const d of daily) {
      if (d.h > MAX_DAY_H)
        out.push({ key: `OVER_DAY|${userId}|${d.date}`, rule: "OVER_DAY", severity: "high", userId, reqId: null, date: d.date, title: `${nm(userId)} — ${d.date} 하루 ${d.h}h`, detail: `하루 기준 ${MAX_DAY_H}h 초과` });
      else if (daily.length >= SPIKE_MIN_DAYS && d.h >= avg * SPIKE_RATIO)
        out.push({ key: `SPIKE|${userId}|${d.date}`, rule: "SPIKE", severity: "low", userId, reqId: null, date: d.date, title: `${nm(userId)} — ${d.date} ${d.h}h (평소 ${r1(avg)}h)`, detail: `본인 평균의 ${r1(d.h / avg)}배` });
    }

    // 몰아서 확정 — 확정 시각(분 단위)이 같은 날짜 수
    const byMinute = new Map<string, Set<string>>();
    ix.conf.forEach((c) => {
      if (c.userId !== userId || c.state !== "CONF" || !c.confirmedAt) return;
      const m = c.confirmedAt.slice(0, 16);
      byMinute.set(m, (byMinute.get(m) ?? new Set()).add(c.workDt));
    });
    byMinute.forEach((ds, m) => {
      if (ds.size >= BULK_MIN_DAYS) {
        const list = Array.from(ds).sort();
        out.push({ key: `BULK_CONF|${userId}|${m}`, rule: "BULK_CONF", severity: "mid", userId, reqId: null, date: list[list.length - 1], title: `${nm(userId)} — ${ds.size}일을 한 번에 확정`, detail: `${m.replace("T", " ")} 에 ${list[0]} ~ ${list[list.length - 1]} 확정` });
      }
    });

    // 확정 지연 (요구사항 × 일자)
    const late = new Map<string, string[]>();
    for (const u of mine)
      ix.daysByUnit.get(u.code)?.forEach((date) => {
        if (daysBetween(date, today) > LATE_DAYS && dayState(ix, userId, u.req, date).st !== "conf" && cellOf(ix, u.code, date).tot > 0) late.set(date, [...(late.get(date) ?? []), u.reqKey]);
      });
    if (late.size) {
      const ds = Array.from(late.keys()).sort();
      out.push({ key: `LATE_CONF|${userId}|${ds[0]}`, rule: "LATE_CONF", severity: "low", userId, reqId: null, date: ds[0], title: `${nm(userId)} — 미확정 ${ds.length}일`, detail: `가장 오래된 날 ${ds[0]} · ${ds.slice(0, 5).join(", ")}${ds.length > 5 ? " …" : ""}` });
    }
  }

  // AI 시간 크게 줄임 (단위 × 일자)
  for (const u of ix.units)
    ix.daysByUnit.get(u.code)?.forEach((date) => {
      const c = cellOf(ix, u.code, date);
      if (c.ai >= 0.5 && c.mn / c.ai > REDUCE_SHARE)
        out.push({ key: `BIG_REDUCE|${u.code}|${date}`, rule: "BIG_REDUCE", severity: "mid", userId: u.ownerId, reqId: u.reqKey, date, title: `${nm(u.ownerId)} — ${u.code} ${STAGE_LABEL[u.stage]} ${date}`, detail: `수집 ${r1(c.ai)}h 중 ${r1(c.mn)}h 줄임 (${Math.round((c.mn / c.ai) * 100)}%)${c.memo ? ` · 메모: ${c.memo}` : ""}` });
    });

  // 요구사항 단위 — 기준 초과, 절감률 과대, AI 없음
  for (const p of ix.data.projects)
    for (const req of p.reqs) {
      const units = ix.units.filter((u) => u.req === req);
      const done = reqDone(req);
      const a = aggTrace(ix, traceUnits(ix, units, done));
      const who = Array.from(new Set(units.map((u) => u.ownerId))).filter(Boolean)[0] ?? null;
      const rk = reqKey(p.prjId, req.reqId);
      const nmOf = `${rk}${req.name && req.name !== req.reqId ? ` ${req.name}` : ""}`;
      if (a.baseMd > 0 && a.md > a.baseMd * OVER_BASE)
        out.push({ key: `OVER_BASE|${rk}`, rule: "OVER_BASE", severity: "mid", userId: who, reqId: rk, date: null, title: nmOf, detail: `투입 ${r1(a.md)} M/D / 기준 ${r1(a.baseMd)} M/D (${Math.round((a.md / a.baseMd) * 100)}%)` });
      if (!done) continue;
      if (a.save !== null && a.save > TOO_GOOD && a.tot > 0)
        out.push({ key: `TOO_GOOD|${rk}`, rule: "TOO_GOOD", severity: "mid", userId: who, reqId: rk, date: null, title: `${nmOf} — 절감률 ${Math.round(a.save * 100)}%`, detail: `기준 ${r1(a.baseMd)} M/D 인데 확정 투입 ${r1(a.md)} M/D` });
      if (a.tot > 0 && a.inT === 0)
        out.push({ key: `NO_AI|${rk}`, rule: "NO_AI", severity: "low", userId: who, reqId: rk, date: null, title: `${nmOf} — AI 사용 0h`, detail: `확정 투입 ${r1(a.tot)}h 가 모두 AI 없이 한 일` });

    }

  // 미배정 세션 방치
  const old = ix.alloc.pending.filter((p) => daysBetween(p.session.workDt, today) > PENDING_DAYS);
  const byUser = new Map<string, number>();
  old.forEach((p) => byUser.set(p.session.userId, (byUser.get(p.session.userId) ?? 0) + 1));
  byUser.forEach((n, userId) =>
    out.push({ key: `PENDING_OLD|${userId}`, rule: "PENDING_OLD", severity: "low", userId, reqId: null, date: null, title: `${nm(userId)} — 미배정 AI 사용 ${n}건`, detail: `${PENDING_DAYS}일 넘게 어느 일인지 정하지 않음` }),
  );

  const rank: Record<Severity, number> = { high: 0, mid: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || (b.date ?? "").localeCompare(a.date ?? ""));
}
