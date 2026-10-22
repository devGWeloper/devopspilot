"use client";

import { useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/apiClient";
import { hm } from "@/lib/format";
import { fmtDay } from "@/lib/labels";
import { freeGaps, fromMin, isHHMM, overlapMin, overlaps, spanMin, toMin, type Interval } from "@/lib/measure/spans";
import { ACT_LABEL, ACT_TYPES, type ActType } from "@/lib/measure/types";
import type { CellVM } from "@/lib/views";
import { useMutate } from "../common/useMutate";
import s from "./effort.module.css";
import { TimeText } from "./TimeFields";

/** 그날 이미 잡힌 시간 — 직접 입력 시간대가 겹치는지 보려고 */
export type BusyItem = Interval & { label: string; kind: "codex" | "direct" };

export interface AddTarget {
  unit: string;
  date: string;
  title: string;
  cell: CellVM | null;
  busy: BusyItem[];
  /** 기본 근무시간 — 새 시간대를 이 안의 빈 곳에 놓는다 */
  work: Interval;
}

/** 작업 유형은 고르기 전엔 비어 있다 — 기본값을 넣으면 안 고른 채 저장돼 다른 유형으로 잡힌다 */
type Row = Interval & { id: number; type: ActType | null };
type Issue = { bad: boolean; text: string };

const STEP = 10;
// 저장 형식이 23:59 까지라 10분 단위 마지막 칸은 23:50
const LAST = 24 * 60 - STEP;

let seq = 0;
const row = (x: Interval & { type: ActType | null }): Row => ({ ...x, id: ++seq });
const okTime = (v: string) => isHHMM(v) && toMin(v) % STEP === 0;
const okRow = (r: Interval) => okTime(r.start) && okTime(r.end);

/** 새 시간대 자리 — 이어서 적는 경우가 많아 마지막 시간대 뒤의 빈 시간부터, 없으면 근무시간 안 빈 곳, 그것도 없으면 마지막 기록 다음 */
function nextSlot(t: AddTarget, rows: Row[]): Interval {
  const mine = rows.filter(okRow);
  const taken = [...t.busy, ...mine];
  const after = Math.max(...mine.map((r) => toMin(r.end)), -1);
  const gaps = freeGaps(taken, t.work.start, t.work.end, STEP);
  const g = gaps.find((x) => toMin(x.start) >= after) ?? gaps[0];
  if (g) return { start: g.start, end: fromMin(Math.min(toMin(g.start) + 60, toMin(g.end))) };
  const latest = Math.max(...taken.map((b) => toMin(b.end)), toMin(t.work.start));
  const st = Math.min(Math.ceil(latest / STEP) * STEP, LAST - STEP);
  return { start: fromMin(st), end: fromMin(Math.min(st + 60, LAST)) };
}

/** 직접 입력(AI 도구 외) — 작업 유형마다 시작~종료 시간대로 */
export function AddTimeDialog({ t, onClose }: { t: AddTarget; onClose: () => void }) {
  const { run, busy } = useMutate();
  const [rows, setRows] = useState<Row[]>(() => {
    const had = (t.cell?.spans ?? []).map(row);
    // 빈 칸을 연 것은 넣으려는 것이라 첫 시간대를 바로 적을 수 있게 열어 둔다.
    return had.length || t.cell?.out ? had : [row({ ...nextSlot(t, []), type: null })];
  });
  const [active, setActive] = useState<number | null>(() => rows.find((r) => !r.type)?.id ?? null);
  // 방금 추가한 시간대 — 시작 시각에 바로 커서를 둔다
  const [fresh, setFresh] = useState<number | null>(active);
  // 시간대를 받기 전에 넣은 값 — 유형별 합계에서 시간대 합을 뺀 나머지
  const [untimed, setUntimed] = useState<Partial<Record<ActType, number>>>(() => {
    const o: Partial<Record<ActType, number>> = {};
    for (const a of ACT_TYPES) {
      const rest = (t.cell?.add[a.cd] ?? 0) - (t.cell?.spans ?? []).filter((x) => x.type === a.cd).reduce((m, x) => m + spanMin(x) / 60, 0);
      if (rest > 1 / 120) o[a.cd] = rest;
    }
    return o;
  });
  const [memo, setMemo] = useState(t.cell?.memo ?? "");

  const issues = rows.map((r): Issue | null => {
    if (!okRow(r)) return { bad: true, text: "시각은 10분 단위로 적어 주세요 (예: 0930 → 09:30)." };
    if (toMin(r.end) <= toMin(r.start)) return { bad: true, text: "끝 시각이 시작보다 늦어야 합니다." };
    const mine = rows.find((o) => o.id !== r.id && okRow(o) && overlaps(r, o));
    if (mine) return { bad: true, text: `${mine.start}~${mine.end} 와 겹칩니다.` };
    const other = t.busy.find((b) => b.kind === "direct" && overlaps(r, b));
    if (other) return { bad: true, text: `${other.start}~${other.end} 는 이미 ${other.label} 에 직접 입력했습니다.` };
    const ai = t.busy.filter((b) => b.kind === "codex" && overlaps(r, b));
    if (ai.length) {
      const m = ai.reduce((a, b) => a + overlapMin(r, b), 0);
      return { bad: false, text: `Codex 세션(${ai.map((b) => `${b.start}~${b.end}`).join(", ")})과 ${hm(m / 60)} 겹칩니다. 그 시간에 Codex 를 쓰지 않았다면 Codex 칸의 '시간 빼기'로 빼 주세요.` };
    }
    return null;
  });
  const spanH = rows.filter(okRow).reduce((a, r) => a + spanMin(r), 0) / 60;
  const untimedH = Object.values(untimed).reduce<number>((a, h) => a + (h ?? 0), 0);
  const out = spanH + untimedH;
  const inT = t.cell?.inT ?? 0;
  const hasA8 = rows.some((r) => r.type === "A8") || (untimed.A8 ?? 0) > 0;
  const why = issues.some((x) => x?.bad)
    ? "시각이 잘못됐거나 겹치는 시간대를 고쳐 주세요."
    : rows.some((r) => !r.type)
      ? "작업 유형을 고르지 않은 시간대가 있습니다."
      : hasA8 && !memo.trim()
        ? "기타를 골랐으면 메모를 적어 주세요."
        : null;

  function add(at: Interval) {
    const r = row({ ...at, type: null });
    setRows((rs) => [...rs, r]);
    setActive(r.id);
    setFresh(r.id);
  }
  // 하루 막대의 빈 곳을 누른 자리부터 한 시간, 다음 기록이 있으면 그 앞까지
  function addAt(m: number) {
    const st = Math.min(Math.floor(m / STEP) * STEP, LAST - STEP);
    const next = Math.min(...[...t.busy, ...rows.filter(okRow)].map((b) => toMin(b.start)).filter((x) => x > st), st + 60, LAST);
    add({ start: fromMin(st), end: fromMin(Math.max(next, st + STEP)) });
  }
  const patch = (id: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  // 끝은 그대로 둔다. 시작이 끝을 넘어설 때만 원래 길이만큼 끝을 민다.
  function setStart(r: Row, v: string) {
    if (okTime(v) && okRow(r) && toMin(v) >= toMin(r.end)) patch(r.id, { start: v, end: fromMin(Math.min(toMin(v) + (spanMin(r) || 60), LAST)) });
    else patch(r.id, { start: v });
  }
  function pick(r: Row, type: ActType) {
    patch(r.id, { type });
    setActive(null);
  }
  function remove(id: number) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    setActive((a) => (a === id ? null : a));
  }

  async function save() {
    const spans = rows.flatMap(({ type, start, end }) => (type ? [{ type, start, end }] : []));
    const ok = await run(() => api("/api/effort/entry", { body: { unit: t.unit, date: t.date, spans, untimed, memo } }), out ? `직접 입력 ${hm(out)}을 저장했습니다.` : "직접 입력 시간을 지웠습니다.");
    if (ok) onClose();
  }

  return (
    <Modal
      open
      wide
      title="직접 입력 — Codex 밖에서 한 일"
      eyebrow={`${fmtDay(t.date)} · ${t.title}`}
      onClose={onClose}
      footer={
        <>
          {why ? (
            <span className={s.why}>{why}</span>
          ) : (
            <span className="muted" style={{ marginRight: "auto", fontSize: 13 }}>
              Codex {hm(inT)} + <b>직접 입력 {hm(out)}</b> = 이 단계 투입 <b>{hm(inT + out)}</b>
            </span>
          )}
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" loading={busy} disabled={!!why} onClick={save}>
            저장
          </Button>
        </>
      }
    >
      <DayStrip t={t} rows={rows} issues={issues} active={active} onPick={(id) => setActive(id === active ? null : id)} onAddAt={addAt} />

      <div className={s.spanList}>
        {rows.length === 0 && <p className={s.spanEmpty}>Codex 없이 일한 시간대를 추가하세요. 위 막대의 빈 곳을 눌러도 됩니다.</p>}
        {rows.map((r, i) => {
          const on = r.id === active;
          const iss = issues[i];
          const endBad = !okTime(r.end) || (okTime(r.start) && toMin(r.end) <= toMin(r.start));
          return (
            <div key={r.id} className={`${s.spanItem} ${on ? s.spanOn : ""}`}>
              <div className={s.spanHead}>
                <span className={s.spanWhen}>
                  <TimeText value={r.start} onChange={(v) => setStart(r, v)} label="시작" invalid={!okTime(r.start)} autoFocus={r.id === fresh} />
                  <span className={s.tilde}>~</span>
                  <TimeText value={r.end} onChange={(v) => patch(r.id, { end: v })} label="종료" invalid={endBad} />
                  <span className={`num ${s.spanDur}`}>{okRow(r) && spanMin(r) > 0 ? hm(spanMin(r) / 60) : "—"}</span>
                </span>
                <button type="button" className={`${s.typeBtn} ${r.type ? "" : s.typeBtnNone} ${on ? s.typeBtnOn : ""}`} onClick={() => setActive(on ? null : r.id)} aria-expanded={on}>
                  <span>{r.type ? ACT_LABEL[r.type] : "작업 유형 고르기"}</span>
                  <i aria-hidden>{on ? "▲" : "▼"}</i>
                </button>
                <button type="button" className={s.spanX} onClick={() => remove(r.id)} aria-label="이 시간대 지우기" title="지우기">
                  ✕
                </button>
              </div>
              {iss && <p className={iss.bad ? s.spanErr : s.spanWarn}>{iss.text}</p>}
              {on && (
                <div className={s.types} role="radiogroup" aria-label="작업 유형">
                  {ACT_TYPES.map((a) => (
                    <button key={a.cd} type="button" role="radio" aria-checked={r.type === a.cd} className={`${s.typeCard} ${r.type === a.cd ? s.typeOn : ""}`} onClick={() => pick(r, a.cd)}>
                      <b>{a.label}</b>
                      <small>{a.desc}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div>
          <Button size="sm" onClick={() => add(nextSlot(t, rows))}>
            ＋ 시간대 추가
          </Button>
        </div>
      </div>

      {untimedH > 0 && (
        <div className={s.busyLine}>
          <span className="subtle">시간대 없이 넣었던 값 — 그대로 두거나 지울 수 있습니다</span>
          {(Object.entries(untimed) as [ActType, number][])
            .filter(([, h]) => h > 0)
            .map(([k, h]) => (
              <span key={k} className={s.busyChip}>
                {ACT_LABEL[k]} {hm(h)}
                <button type="button" className={s.spanDel} onClick={() => setUntimed({ ...untimed, [k]: 0 })} aria-label={`${ACT_LABEL[k]} 지우기`}>
                  ✕
                </button>
              </span>
            ))}
        </div>
      )}

      <label className={s.memo}>
        <span>
          메모 <span className="subtle">{hasA8 ? "— 기타를 골랐으니 꼭 적어 주세요" : "(선택)"}</span>
        </span>
        <TextInput value={memo} maxLength={200} onChange={(e) => setMemo(e.target.value)} placeholder="어떤 일이었는지 한 줄" invalid={hasA8 && !memo.trim()} />
      </label>
    </Modal>
  );
}

/** 그날 하루 막대 — 이미 잡힌 시간 옆에 이 단계 시간대를 그려 빈 자리를 눈으로 찾게 한다 */
function DayStrip({
  t,
  rows,
  issues,
  active,
  onPick,
  onAddAt,
}: {
  t: AddTarget;
  rows: Row[];
  issues: (Issue | null)[];
  active: number | null;
  onPick: (id: number) => void;
  onAddAt: (m: number) => void;
}) {
  const mine = rows.map((r, i) => ({ r, iss: issues[i] })).filter(({ r }) => okRow(r) && toMin(r.end) > toMin(r.start));
  const all = [...t.busy.filter((b) => toMin(b.end) > toMin(b.start)), ...mine.map((x) => x.r)];
  const lo = Math.floor(Math.min(toMin(t.work.start), ...all.map((b) => toMin(b.start))) / 60) * 60;
  const hi = Math.min(24 * 60, Math.ceil(Math.max(toMin(t.work.end), ...all.map((b) => toMin(b.end))) / 60) * 60);
  const span = Math.max(60, hi - lo);
  const x = (m: number) => `${((m - lo) / span) * 100}%`;
  const w = (a: Interval) => `${(spanMin(a) / span) * 100}%`;
  const every = span > 12 * 60 ? 120 : 60;
  const ticks = Array.from({ length: Math.floor(span / every) + 1 }, (_, i) => lo + i * every);

  function click(e: MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const b = e.currentTarget.getBoundingClientRect();
    onAddAt(lo + ((e.clientX - b.left) / b.width) * span);
  }

  return (
    <div className={s.strip}>
      <span />
      <div className={s.stripAxis}>
        {ticks.map((m) => (
          <span key={m} style={{ left: x(m) }}>
            {m / 60}시
          </span>
        ))}
      </div>

      <span className={s.stripLane}>이미 잡힌 시간</span>
      <div className={s.stripTrack}>
        {ticks.map((m) => (
          <i key={m} className={s.stripTick} style={{ left: x(m) }} />
        ))}
        {t.busy.map((b, i) => (
          <span key={i} className={`${s.sb} ${b.kind === "codex" ? s.sbCodex : s.sbOther}`} style={{ left: x(toMin(b.start)), width: w(b) }} title={`${b.kind === "codex" ? "Codex" : "직접 입력"} ${b.start}~${b.end} · ${b.label}`}>
            {b.kind === "codex" ? "Codex" : b.label}
          </span>
        ))}
        {t.busy.length === 0 && <span className={s.stripNone}>없음</span>}
      </div>

      <span className={s.stripLane}>
        이 단계
        <small>빈 곳을 누르면 추가</small>
      </span>
      <div className={`${s.stripTrack} ${s.stripMine}`} onClick={click} title="빈 곳을 누르면 그 시각부터 시간대를 추가합니다">
        {ticks.map((m) => (
          <i key={m} className={s.stripTick} style={{ left: x(m) }} />
        ))}
        {mine.map(({ r, iss }) => (
          <button
            key={r.id}
            type="button"
            className={[s.sb, s.sbMine, r.type ? "" : s.sbNone, r.id === active ? s.sbOn : "", iss ? (iss.bad ? s.sbBad : s.sbWarn) : ""].join(" ")}
            style={{ left: x(toMin(r.start)), width: w(r) }}
            onClick={() => onPick(r.id)}
            title={`${r.start}~${r.end} · ${r.type ? ACT_LABEL[r.type] : "작업 유형 미선택"}`}
          >
            {r.type ? ACT_LABEL[r.type] : "?"}
          </button>
        ))}
      </div>
    </div>
  );
}
