"use client";

import { Fragment, useState } from "react";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Callout, EmptyState, Panel, Skeleton } from "@/components/ui/Panel";
import t from "@/components/ui/table.module.css";
import { useApi } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/labels";
import type { HistoryEntry } from "@/lib/types";

// 예전 과제 수정 이력은 항목별 변경 목록을 diff 로 남겼다 — DB 에 남은 그 이력을 펼쳐 보이기 위해 둔다.
type DiffItem = { key: string; before: unknown; after: unknown };

const TARGET_LABEL: Record<string, string> = {
  PROJECT: "과제·요구사항",
  EFFORT: "공수 확정",
  UPLOAD: "AI 기록 업로드",
  SETTINGS: "코드·단가",
  USER: "계정",
}

function show(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v).slice(0, 160);
  return String(v);
}

export function HistoryView() {
  const [typ, setTyp] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const qs = new URLSearchParams({ ...(typ ? { targetTyp: typ } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const { data, error } = useApi<HistoryEntry[]>(`/api/admin/history${qs ? `?${qs}` : ""}`);

  return (
    <>
      <Panel flush>
        <div style={{ display: "flex", gap: 12, padding: 16, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <Field label="대상">
            <Select value={typ} onChange={(e) => setTyp(e.target.value)}>
              <option value="">전체</option>
              {Object.entries(TARGET_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="시작일">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="종료일">
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        {error && <Callout tone="danger">{error}</Callout>}
        {!data ? (
          <Skeleton h={300} />
        ) : data.length === 0 ? (
          <EmptyState icon="history" title="조건에 맞는 이력이 없습니다" />
        ) : (
          <div className={t.wrap}>
            <table className={t.table}>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>일시</th>
                  <th style={{ width: 100 }}>대상</th>
                  <th style={{ width: 110 }}>ID</th>
                  <th>내용</th>
                  <th style={{ width: 110 }}>사용자</th>
                </tr>
              </thead>
              <tbody>
                {data.map((h) => {
                  const diff = Array.isArray(h.diff) ? (h.diff as DiffItem[]) : [];
                  return (
                    <Fragment key={h.histId}>
                      <tr className={diff.length ? t.clickable : ""} onClick={() => diff.length && setOpen(open === h.histId ? null : h.histId)}>
                        <td className="num subtle">{fmtDateTime(h.regAt)}</td>
                        <td>{TARGET_LABEL[h.targetTyp] ?? h.targetTyp}</td>
                        <td>{h.targetId}</td>
                        <td>
                          {h.summary}
                          {diff.length > 0 && <span className="subtle"> · 변경 {diff.length}개 {open === h.histId ? "▲" : "▼"}</span>}
                        </td>
                        <td>{h.userNm}</td>
                      </tr>
                      {open === h.histId && (
                        <tr>
                          <td colSpan={5} style={{ background: "var(--surface-2)" }}>
                            <table style={{ width: "100%", fontSize: 12.5 }}>
                              <tbody>
                                {diff.map((d) => (
                                  <tr key={d.key}>
                                    <td style={{ width: 120, fontWeight: 600, padding: 4 }}>{d.key}</td>
                                    <td style={{ color: "var(--danger)", padding: 4, wordBreak: "break-all" }}>{show(d.before)}</td>
                                    <td style={{ width: 20, padding: 4 }}>→</td>
                                    <td style={{ color: "var(--ok)", padding: 4, wordBreak: "break-all" }}>{show(d.after)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
