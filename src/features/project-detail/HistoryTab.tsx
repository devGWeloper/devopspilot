"use client";

import { Callout, EmptyState, Panel, Skeleton } from "@/components/ui/Panel";
import type { DiffItem } from "@/lib/diff";
import { useApi } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/labels";
import type { HistoryEntry } from "@/lib/types";
import s from "./detail.module.css";

const FIELD: Record<string, string> = {
  prjNm: "과제명",
  sysNm: "시스템명",
  pmUserId: "PM",
  status: "상태",
  statusNote: "사유",
  suggestFit: "제안 적합도",
  finalFit: "확정 적합도",
  answers: "지표 응답",
  base: "기본정보·실적",
};

export function HistoryTab({ prjId }: { prjId: string }) {
  const { data, error } = useApi<HistoryEntry[]>(`/api/projects/${prjId}/history`);
  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!data) return <Skeleton h={200} />;
  return (
    <Panel eyebrow="Audit trail" title="변경 이력">
      {data.length === 0 ? (
        <EmptyState icon="history" title="이력이 없습니다" />
      ) : (
        <ol className={s.timeline}>
          {data.map((h) => {
            const diff = Array.isArray(h.diff) ? (h.diff as DiffItem[]) : [];
            return (
              <li key={h.histId} className={s.tlItem}>
                <span className={s.tlWhen}>{fmtDateTime(h.regAt)}</span>
                <div className={s.tlBody}>
                  <span>
                    <b>{h.userNm}</b> · {h.summary}
                  </span>
                  {diff.length > 0 && <span className={s.tlDiff}>변경 항목: {diff.map((d) => FIELD[d.key] ?? d.key).join(", ")}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
