"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/apiClient";
import { f1 } from "@/lib/format";
import { fmtDay } from "@/lib/labels";
import { ACT_TYPES, type ActType } from "@/lib/measure/types";
import type { CellVM } from "@/lib/views";
import { useMutate } from "../common/useMutate";
import s from "./effort.module.css";

export interface AddTarget {
  unit: string;
  date: string;
  title: string;
  cell: CellVM | null;
}

/** 직접 입력(AI 도구 외) — 작업 유형 8개, 0.1시간 단위 */
export function AddTimeDialog({ t, onClose }: { t: AddTarget; onClose: () => void }) {
  const { run, busy } = useMutate();
  const [v, setV] = useState<Partial<Record<ActType, string>>>(
    Object.fromEntries(Object.entries(t.cell?.add ?? {}).map(([k, h]) => [k, String(h)])) as Partial<Record<ActType, string>>,
  );
  const [memo, setMemo] = useState(t.cell?.memo ?? "");
  const nums = Object.fromEntries(ACT_TYPES.map((a) => [a.cd, Math.max(0, Math.round((parseFloat(v[a.cd] ?? "") || 0) * 10) / 10)])) as Record<ActType, number>;
  const out = Object.values(nums).reduce((a, x) => a + x, 0);
  const inT = t.cell?.inT ?? 0;
  const memoMissing = nums.A8 > 0 && !memo.trim();

  async function save() {
    const ok = await run(() => api("/api/effort/entry", { body: { unit: t.unit, date: t.date, add: nums, memo } }), out ? `직접 입력 ${f1(out)}시간을 저장했습니다.` : "직접 입력 시간을 지웠습니다.");
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
          <span className="muted" style={{ marginRight: "auto", fontSize: 13 }}>
            Codex {f1(inT)}h + <b>직접 입력 {f1(out)}h</b> = 이 단계 투입 <b>{f1(inT + out)}h</b>
          </span>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" loading={busy} disabled={memoMissing} onClick={save}>
            저장
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {ACT_TYPES.map((a, i) => (
          <label key={a.cd} className={`${s.tyrow} ${nums[a.cd] ? s.tyrowOn : ""}`}>
            <span>
              <b>
                {a.cd} {a.label}
              </b>
              <span className={s.meta} style={{ whiteSpace: "normal" }}>
                {a.desc}
              </span>
            </span>
            <span>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="16"
                placeholder="0.0"
                autoFocus={i === 0}
                value={v[a.cd] ?? ""}
                onChange={(e) => setV({ ...v, [a.cd]: e.target.value })}
                aria-label={`${a.label} 시간`}
              />{" "}
              h
            </span>
          </label>
        ))}
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12, fontSize: 13 }}>
        <span>
          메모 <span className="subtle">{nums.A8 > 0 ? "— A8 기타는 필수" : "(선택)"}</span>
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
    </Modal>
  );
}
