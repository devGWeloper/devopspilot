"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/apiClient";
import { f1 } from "@/lib/format";
import { fmtDay } from "@/lib/labels";
import type { PendingVM } from "@/lib/views";
import b from "../common/board.module.css";
import { useMutate } from "../common/useMutate";
import s from "./effort.module.css";

/** 업무 코드 없이 잡힌 AI 사용 — 배정하거나 업무 외로 표시해야 집계된다 */
export function PendingPanel({ list, readOnly, showUser, onClose }: { list: PendingVM[]; readOnly: boolean; showUser: boolean; onClose: () => void }) {
  const { run, busy } = useMutate();
  const [split, setSplit] = useState<PendingVM | null>(null);

  const assign = (p: PendingVM, unit: string, label: string) =>
    run(() => api("/api/effort/sessions", { body: { datId: p.datId, parts: [{ unit, min: p.minutes }] } }), `${label}에 ${f1(p.minutes / 60)}h 배정했습니다. 확정한 날이면 다시 확정해 주세요.`);
  const off = (p: PendingVM) => run(() => api("/api/effort/sessions", { body: { datId: p.datId, off: true } }), `${fmtDay(p.date)} ${p.start}~${p.end}을 업무 외로 표시했습니다.`);

  return (
    <section className={s.panel} aria-label="확인 필요">
      <div className={s.rqh}>
        <h3 style={{ fontSize: 16 }}>확인 필요 · 업무 코드 없이 잡힌 AI 사용</h3>
        <Button size="sm" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
      <p className={b.small} style={{ color: "var(--muted)" }}>
        브랜치명·대화에서 요구사항 단계를 하나로 정하지 못한 시간입니다. 배정하면 그날 그 단계의 AI 시간에 더해지고, 업무 외로 표시하면 집계에서 빠집니다.
      </p>
      {list.length === 0 && <p className="muted">확인할 시간이 없습니다.</p>}
      {list.map((p) => {
        const others = p.options.filter((o) => !p.cands.some((c) => c.code === o.code));
        return (
          <div key={p.datId} className={s.una}>
            <div>
              <b>
                {fmtDay(p.date)} {p.start}
                {p.end ? ` ~ ${p.end}` : ""}
              </b>{" "}
              <span className="num">{f1(p.minutes / 60)}h</span>
              {showUser && <span className={b.xs}> · {p.userNm}</span>}
              <div className={b.small}>
                {p.tool} · 브랜치 {p.branch || "—"}
              </div>
              <div className={s.why}>{p.why}</div>
            </div>
            {readOnly ? (
              <span className={b.xs}>개발자 본인이 처리합니다</span>
            ) : (
              <div className={s.chipset}>
                {p.cands.map((c) => (
                  <button key={c.code} disabled={busy} onClick={() => assign(p, c.code, c.label)}>
                    {c.label}
                  </button>
                ))}
                <select
                  className={b.sel}
                  value=""
                  disabled={busy}
                  onChange={(e) => {
                    const o = p.options.find((x) => x.code === e.target.value);
                    if (o) void assign(p, o.code, o.label);
                  }}
                  aria-label="요구사항·단계 선택"
                >
                  <option value="">{p.cands.length ? "다른 요구사항·단계" : "요구사항·단계 선택"}</option>
                  {others.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label} ({o.code})
                    </option>
                  ))}
                </select>
                <button disabled={busy} onClick={() => setSplit(p)}>
                  나눠서 배정
                </button>
                <button className={s.np} disabled={busy} onClick={() => off(p)}>
                  업무 외 사용
                </button>
              </div>
            )}
          </div>
        );
      })}
      {split && <SplitDialog p={split} onClose={() => setSplit(null)} />}
    </section>
  );
}

function SplitDialog({ p, onClose }: { p: PendingVM; onClose: () => void }) {
  const { run, busy } = useMutate();
  const [v, setV] = useState<Record<string, string>>({});
  const total = Math.round((p.minutes / 60) * 10) / 10;
  const parts = Object.entries(v)
    .map(([unit, h]) => ({ unit, h: Math.max(0, Math.round((parseFloat(h) || 0) * 10) / 10) }))
    .filter((x) => x.h > 0);
  const sum = Math.round(parts.reduce((a, x) => a + x.h, 0) * 10) / 10;
  const over = sum > total + 1e-9;
  const codes = [...p.cands, ...p.options.filter((o) => !p.cands.some((c) => c.code === o.code))];

  async function save() {
    // 남는 시간은 배정하지 않은 것 = 업무 외로 취급된다.
    const ok = await run(
      () => api("/api/effort/sessions", { body: { datId: p.datId, parts: parts.map((x) => ({ unit: x.unit, min: Math.min(p.minutes, Math.round(x.h * 60)) })) } }),
      `${parts.length}개 단계에 ${f1(sum)}h 배정했습니다.`,
    );
    if (ok) onClose();
  }

  return (
    <Modal
      open
      title="나눠서 배정"
      eyebrow={`${fmtDay(p.date)} ${p.start}~${p.end} · ${f1(total)}h`}
      onClose={onClose}
      footer={
        <>
          <span className={over ? b.danger : "muted"} style={{ marginRight: "auto", fontSize: 13 }}>
            배정 {f1(sum)}h / {f1(total)}h · 남는 {f1(Math.max(0, total - sum))}h → 업무 외
          </span>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" loading={busy} disabled={!parts.length || over} onClick={save}>
            배정
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {codes.map((c) => (
          <label key={c.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span className={b.small}>
              {c.label} <span className={b.xs}>{c.code}</span>
            </span>
            <span>
              <input type="number" step="0.1" min="0" max={total} placeholder="0.0" className={b.sel} style={{ width: 80, textAlign: "right" }} value={v[c.code] ?? ""} onChange={(e) => setV({ ...v, [c.code]: e.target.value })} /> h
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
