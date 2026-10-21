"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/apiClient";
import { hm } from "@/lib/format";
import { fmtDay } from "@/lib/labels";
import { fromMin, overlapMin, overlaps, spanMin, toMin, type EffortSpan, type Interval } from "@/lib/measure/spans";
import { ACT_LABEL, ACT_TYPES, type ActType } from "@/lib/measure/types";
import type { CellVM } from "@/lib/views";
import { useMutate } from "../common/useMutate";
import s from "./effort.module.css";
import { TimeInput } from "./TimeFields";

/** 그날 이미 잡힌 시간 — 직접 입력 시간대가 겹치는지 보려고 */
export type BusyItem = Interval & { label: string; kind: "codex" | "direct" };

export interface AddTarget {
  unit: string;
  date: string;
  title: string;
  cell: CellVM | null;
  busy: BusyItem[];
  /** 기본 근무 시작 — 그날 기록이 없을 때 새 시간대의 기본값 */
  workStart: string;
}

type Row = EffortSpan & { id: number };

let seq = 0;
const row = (x: EffortSpan): Row => ({ ...x, id: ++seq });

/** 직접 입력(AI 도구 외) — 작업 유형마다 시작~종료 시간대로 */
export function AddTimeDialog({ t, onClose }: { t: AddTarget; onClose: () => void }) {
  const { run, busy } = useMutate();
  const [rows, setRows] = useState<Row[]>(() => (t.cell?.spans ?? []).map(row));
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

  const issues = rows.map((r, i) => {
    if (toMin(r.end) <= toMin(r.start)) return { bad: true, text: "끝 시각이 시작보다 늦어야 합니다." };
    const mine = rows.find((o, j) => j !== i && overlaps(r, o));
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
  const spanH = rows.reduce((a, r) => a + spanMin(r), 0) / 60;
  const untimedH = Object.values(untimed).reduce<number>((a, h) => a + (h ?? 0), 0);
  const out = spanH + untimedH;
  const inT = t.cell?.inT ?? 0;
  const hasA8 = rows.some((r) => r.type === "A8") || (untimed.A8 ?? 0) > 0;
  const memoMissing = hasA8 && !memo.trim();
  const blocked = issues.some((x) => x?.bad) || memoMissing;

  function addRow() {
    const last = rows[rows.length - 1];
    // 이어서 적는 경우가 많아 마지막으로 잡힌 시각 다음부터 — 10분 단위로 올린다.
    const latest = Math.max(...t.busy.map((b) => toMin(b.end)), -1);
    const start = last ? last.end : latest >= 0 ? fromMin(Math.ceil(latest / 10) * 10) : t.workStart;
    setRows([...rows, row({ type: last?.type ?? "A1", start, end: fromMin(Math.min(toMin(start) + 60, 24 * 60 - 10)) })]);
  }
  const patch = (id: number, p: Partial<EffortSpan>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...p } : r)));

  async function save() {
    const spans = rows.map(({ type, start, end }) => ({ type, start, end }));
    const ok = await run(() => api("/api/effort/entry", { body: { unit: t.unit, date: t.date, spans, untimed, memo } }), out ? `직접 입력 ${hm(out)}을 저장했습니다.` : "직접 입력 시간을 지웠습니다.");
    if (ok) onClose();
  }

  const codex = t.busy.filter((b) => b.kind === "codex");
  const others = t.busy.filter((b) => b.kind === "direct");

  return (
    <Modal
      open
      wide
      title="직접 입력 — Codex 밖에서 한 일"
      eyebrow={`${fmtDay(t.date)} · ${t.title}`}
      onClose={onClose}
      footer={
        <>
          <span className="muted" style={{ marginRight: "auto", fontSize: 13 }}>
            Codex {hm(inT)} + <b>직접 입력 {hm(out)}</b> = 이 단계 투입 <b>{hm(inT + out)}</b>
          </span>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" loading={busy} disabled={blocked} onClick={save}>
            저장
          </Button>
        </>
      }
    >
      {(codex.length > 0 || others.length > 0) && (
        <div className={s.busyLine}>
          <span className="subtle">이 날 이미 잡힌 시간</span>
          {codex.map((b, i) => (
            <span key={`c${i}`} className={s.busyChip} title={b.label}>
              Codex {b.start}~{b.end}
            </span>
          ))}
          {others.map((b, i) => (
            <span key={`d${i}`} className={`${s.busyChip} ${s.busyDirect}`} title={b.label}>
              {b.start}~{b.end} {b.label}
            </span>
          ))}
        </div>
      )}

      <div className={s.spanList}>
        {rows.length === 0 && <p className="subtle" style={{ margin: "4px 0 8px", fontSize: 13 }}>Codex 없이 일한 시간대를 추가하세요. 예: 13:00~14:30 협의·소통</p>}
        {rows.map((r, i) => (
          <div key={r.id} className={s.spanRow}>
            <select className={s.spanType} value={r.type} onChange={(e) => patch(r.id, { type: e.target.value as ActType })} aria-label="작업 유형">
              {ACT_TYPES.map((a) => (
                <option key={a.cd} value={a.cd}>
                  {a.cd} {a.label}
                </option>
              ))}
            </select>
            <TimeInput value={r.start} onChange={(v) => patch(r.id, { start: v })} label="시작" invalid={issues[i]?.bad} />
            <span className="subtle">~</span>
            <TimeInput value={r.end} onChange={(v) => patch(r.id, { end: v })} label="종료" invalid={issues[i]?.bad} />
            <b className={`num ${s.spanDur}`}>{hm(spanMin(r) / 60)}</b>
            <button type="button" className={s.spanDel} onClick={() => setRows(rows.filter((x) => x.id !== r.id))} aria-label="이 시간대 지우기">
              ✕
            </button>
            {issues[i] && <span className={issues[i]!.bad ? s.spanErr : s.spanWarn}>{issues[i]!.text}</span>}
          </div>
        ))}
        <div>
          <Button size="sm" onClick={addRow}>
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

      <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12, fontSize: 13 }}>
        <span>
          메모 <span className="subtle">{hasA8 ? "— A8 기타는 필수" : "(선택)"}</span>
        </span>
        <input
          type="text"
          value={memo}
          maxLength={200}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="어떤 일이었는지 한 줄"
          style={{ border: "1px solid var(--line-strong)", borderRadius: 6, padding: "6px 8px" }}
        />
      </label>

      <details className={s.typeHelp}>
        <summary>작업 유형 설명</summary>
        <dl>
          {ACT_TYPES.map((a) => (
            <div key={a.cd}>
              <dt>
                {a.cd} {a.label}
              </dt>
              <dd>{a.desc}</dd>
            </div>
          ))}
        </dl>
      </details>
    </Modal>
  );
}
