"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FitBadge } from "@/components/ui/FitBadge";
import { EmptyState, Panel } from "@/components/ui/Panel";
import { useRefs } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/labels";
import type { Project } from "@/lib/types";
import { ConfirmFitDialog } from "../project-detail/ConfirmFitDialog";
import s from "./ai.module.css";

export default function AiResultTab({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const { criteria } = useRefs();
  const [open, setOpen] = useState(false);
  const ai = project.ai;
  if (!ai) return <EmptyState icon="spark" title="AI 의견이 없습니다">관리 &gt; AI 판정 화면에서 이 과제를 선택해 실행하세요.</EmptyState>;
  const nameOf = (id: string) => criteria?.areas.flatMap((a) => a.indicators).find((i) => i.id === id)?.name ?? id;

  return (
    <div className={s.result}>
      <Panel
        eyebrow={`${ai.model} · 프롬프트 v${ai.promptVersion} · 기준 v${ai.criteriaVersion} · ${fmtDateTime(ai.assessedAt)}`}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            AI 의견 <FitBadge fit={ai.grade} confirmed={false} />
          </span>
        }
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            확정 적합도로 반영
          </Button>
        }
      >
        <p className={s.summary}>{ai.summary}</p>
        <div className={s.cols}>
          <div>
            <span className="eyebrow">강점</span>
            <ul>
              {ai.strengths.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="eyebrow">리스크</span>
            <ul>
              {ai.risks.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
        {ai.replayNotes && (
          <div className={s.block}>
            <span className="eyebrow">Replay 수행 시 유의사항</span>
            <p>{ai.replayNotes}</p>
          </div>
        )}
        {ai.balanceNote && (
          <div className={s.block}>
            <span className="eyebrow">선정 균형 의견</span>
            <p>{ai.balanceNote}</p>
          </div>
        )}
        {ai.indicatorComments.length > 0 && (
          <div className={s.block}>
            <span className="eyebrow">지표별 의견</span>
            <dl className={s.dl}>
              {ai.indicatorComments.map((c) => (
                <div key={c.indicatorId}>
                  <dt>{nameOf(c.indicatorId)}</dt>
                  <dd>{c.comment}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <p className="subtle" style={{ fontSize: 12, marginTop: 12 }}>
          AI 의견은 참고용입니다. 반영하면 사유에 AI 요약이 채워진 확정 창이 열리고, 확정은 AX 관리자가 직접 합니다.
        </p>
      </Panel>
      <ConfirmFitDialog open={open} project={project} initialFit={ai.grade} initialReason={`AI 의견: ${ai.summary}`} onClose={() => setOpen(false)} onDone={(p) => (onChange(p), setOpen(false))} />
    </div>
  );
}
