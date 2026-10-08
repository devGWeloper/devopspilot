"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Callout, EmptyState, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { hours } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { kstDate } from "@/lib/measure/csv";
import { addDays } from "@/lib/measure/postfix";
import { AI_LEVEL_LABEL, FEATURE_STATUS_LABEL, PHASE_LABEL, PHASES, type AiLevel, type Effort, type Feature, type Phase } from "@/lib/measure/types";
import s from "./today.module.css";

interface Item {
  feature: Feature;
  prjNm: string;
  a: number;
  b: number;
  today: Effort[];
  lastWorkDt: string | null;
}

interface TodayData {
  date: string;
  phases: Record<Phase, boolean>;
  items: Item[];
}

const key = (f: Feature, p: Phase) => `${f.prjId}|${f.wbsId}|${p}`;
const fkey = (f: Feature) => `${f.prjId}|${f.wbsId}`;

export function TodayForm() {
  const { toast, toastError } = useToast();
  const [date, setDate] = useState(() => kstDate(Date.now()));
  const { data, error, reload } = useApi<TodayData>(`/api/measure/today?date=${date}`);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [ai, setAi] = useState<Record<string, AiLevel | null>>({});
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const initial = useMemo(() => {
    const v: Record<string, string> = {};
    const a: Record<string, AiLevel | null> = {};
    for (const it of data?.items ?? []) {
      for (const e of it.today) v[key(it.feature, e.phase)] = String(e.hours);
      a[fkey(it.feature)] = it.today.find((e) => e.aiLevel)?.aiLevel ?? null;
    }
    return { v, a };
  }, [data]);

  useEffect(() => {
    setVals(initial.v);
    setAi(initial.a);
    setDone(new Set());
  }, [initial]);

  const phases = PHASES.filter((p) => data?.phases[p]);
  const items = (data?.items ?? []).slice().sort((x, y) => Number(x.feature.status === "DONE") - Number(y.feature.status === "DONE"));

  const changed = useMemo(() => {
    const out: { prjId: string; wbsId: string; phase: Phase; hours: number; aiLevel: AiLevel | null }[] = [];
    for (const it of items) {
      const aiChanged = (ai[fkey(it.feature)] ?? null) !== (initial.a[fkey(it.feature)] ?? null);
      for (const p of phases) {
        const k = key(it.feature, p);
        const now = vals[k] ?? "";
        const was = initial.v[k] ?? "";
        if (now === was && !(aiChanged && now)) continue;
        const h = now.trim() === "" ? 0 : Number(now);
        out.push({ prjId: it.feature.prjId, wbsId: it.feature.wbsId, phase: p, hours: h, aiLevel: ai[fkey(it.feature)] ?? null });
      }
    }
    return out;
  }, [vals, ai, items, phases, initial]);

  const invalid = changed.some((c) => !Number.isFinite(c.hours) || c.hours < 0 || c.hours > 24);
  const totalToday = items.reduce((s, it) => s + phases.reduce((t, p) => t + (Number(vals[key(it.feature, p)]) || 0), 0), 0);

  function bump(k: string, d: number) {
    setVals((v) => {
      const n = Math.max(0, Math.min(24, (Number(v[k]) || 0) + d));
      return { ...v, [k]: n ? String(n) : "" };
    });
  }

  async function save() {
    setBusy(true);
    try {
      const completes = items.filter((it) => done.has(fkey(it.feature))).map((it) => ({ prjId: it.feature.prjId, wbsId: it.feature.wbsId }));
      await api("/api/measure/today", { body: { date, items: changed, completes } });
      const n = new Set([...changed.map((c) => `${c.prjId}|${c.wbsId}`), ...completes.map((c) => `${c.prjId}|${c.wbsId}`)]).size;
      toast(`${n}개 기능 · ${hours(totalToday)} 저장했습니다.`);
      await reload();
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const dirty = changed.length > 0 || done.size > 0;
  const today = kstDate(Date.now());

  return (
    <div className={s.wrap}>
      <PageHeader eyebrow="Daily effort" title="오늘 공수 입력" description="담당 기능별로 오늘 투입한 시간을 단계별로 적고 저장하세요. 퇴근 전 1분이면 충분합니다." />

      <div className={s.dateBar}>
        <button className={s.dateBtn} onClick={() => setDate(addDays(date, -1))} aria-label="전날">
          <Icon name="chevronLeft" size={18} />
        </button>
        <label className={s.dateLabel}>
          <Icon name="calendar" size={16} />
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="작업일" />
          {date === today && <span className={s.todayTag}>오늘</span>}
        </label>
        <button className={s.dateBtn} onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="다음날">
          <Icon name="chevronRight" size={18} />
        </button>
        <span className={s.dateSum}>
          합계 <b className="num">{hours(totalToday)}</b>
        </span>
      </div>

      {error && <Callout tone="danger">{error}</Callout>}
      {!data ? (
        <div style={{ display: "grid", gap: 12 }}>
          <Skeleton h={180} />
          <Skeleton h={180} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="clock" title="배정된 기능이 없습니다">
          선정된 과제의 PM 이 기능을 등록하고 담당 개발자로 지정하면 이곳에 나타납니다.
        </EmptyState>
      ) : (
        <div className={s.cards}>
          {items.map((it) => {
            const f = it.feature;
            const fk = fkey(f);
            const progress = it.a > 0 ? Math.min(100, (it.b / it.a) * 100) : 0;
            const isDone = f.status === "DONE";
            return (
              <article key={fk} className={`${s.card} ${isDone ? s.cardDone : ""}`}>
                <header className={s.cardHead}>
                  <div>
                    <span className="eyebrow">
                      {f.wbsId} · {it.prjNm}
                    </span>
                    <h2 className={s.cardTitle}>
                      <Link href={`/projects/${f.prjId}?tab=measure`}>{f.name}</Link>
                    </h2>
                  </div>
                  <Chip tone={isDone ? "ok" : f.status === "DOING" ? "accent" : "neutral"}>{FEATURE_STATUS_LABEL[f.status]}</Chip>
                </header>
                <div className={s.progress} title={`Replay 누적 ${hours(it.b)} / 기존 실적 ${hours(it.a)}`}>
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div className={s.progressText}>
                  <span>
                    Replay 누적 <b className="num">{hours(it.b)}</b> / 기존 실적 {hours(it.a)}
                  </span>
                  {it.lastWorkDt && <span className="subtle">최근 기록 {it.lastWorkDt}</span>}
                </div>
                <div className={s.inputs}>
                  {phases.map((p) => {
                    const k = key(f, p);
                    const v = vals[k] ?? "";
                    const bad = v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 24);
                    return (
                      <div key={p} className={s.field}>
                        <span className={s.fieldLabel}>{PHASE_LABEL[p]}</span>
                        <div className={`${s.stepper} ${bad ? s.bad : ""}`}>
                          <button type="button" onClick={() => bump(k, -0.5)} aria-label={`${PHASE_LABEL[p]} 0.5시간 빼기`}>
                            −
                          </button>
                          <input
                            inputMode="decimal"
                            value={v}
                            placeholder="0"
                            onChange={(e) => setVals((x) => ({ ...x, [k]: e.target.value.replace(/[^0-9.]/g, "") }))}
                            aria-label={`${f.wbsId} ${PHASE_LABEL[p]} 시간`}
                          />
                          <button type="button" onClick={() => bump(k, 0.5)} aria-label={`${PHASE_LABEL[p]} 0.5시간 더하기`}>
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className={s.cardFoot}>
                  <div className={s.aiSeg} role="radiogroup" aria-label="AI 활용 정도">
                    <span className="subtle">AI 활용</span>
                    {(["NONE", "PARTIAL", "LEAD"] as const).map((lv) => (
                      <button key={lv} role="radio" aria-checked={ai[fk] === lv} onClick={() => setAi((x) => ({ ...x, [fk]: x[fk] === lv ? null : lv }))}>
                        {AI_LEVEL_LABEL[lv]}
                      </button>
                    ))}
                  </div>
                  {!isDone && (
                    <label className={s.doneCheck}>
                      <input type="checkbox" checked={done.has(fk)} onChange={(e) => setDone((x) => new Set(e.target.checked ? [...x, fk] : [...x].filter((y) => y !== fk)))} />
                      {date} 로 완료 처리
                    </label>
                  )}
                  {isDone && <span className="subtle">완료일 {f.completedAt}</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className={`${s.saveBar} no-print`}>
        <span className="muted">{dirty ? `변경 ${changed.length + done.size}건` : "변경 없음"}</span>
        <Button variant="primary" loading={busy} disabled={!dirty || invalid} onClick={save} className={s.saveBtn}>
          저장
        </Button>
      </div>
    </div>
  );
}
