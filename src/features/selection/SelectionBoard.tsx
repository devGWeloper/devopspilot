"use client";

import Link from "next/link";
import { useMemo, useState, type DragEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AgreementSeal } from "@/components/ui/AgreementSeal";
import { Chip } from "@/components/ui/Chip";
import { FitPair } from "@/components/ui/FitBadge";
import { Callout, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileStrip } from "@/components/ui/ProfileStrip";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { can } from "@/lib/auth/permissions";
import { buildProfile } from "@/lib/fitness";
import { labelOf, useApi, useRefs } from "@/lib/hooks";
import { STATUS_LABEL } from "@/lib/labels";
import { canTransition, noteRequired } from "@/lib/projects/transitions";
import type { Project, ProjectStatus } from "@/lib/types";
import { selectionWarnings, StatusDialog } from "../project-detail/StatusDialog";
import { BalancePanel } from "./BalancePanel";
import s from "./board.module.css";

const COLUMNS: { key: ProjectStatus; also?: ProjectStatus[]; hint: string }[] = [
  { key: "DRAFT", also: ["SUPPLEMENT"], hint: "PM 작성·보완 중" },
  { key: "SUBMITTED", hint: "검토 대기" },
  { key: "REVIEW", hint: "AX·HX 검토" },
  { key: "SELECTED", hint: "Replay 대상 확정" },
  { key: "RESERVE", hint: "대체 후보" },
  { key: "EXCLUDED", hint: "선정 제외" },
];

export function SelectionBoard() {
  const { me } = useAuth();
  const { criteria, codes } = useRefs();
  const { toast, toastError } = useToast();
  const { data, setData, error, loading } = useApi<Project[]>("/api/projects");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<ProjectStatus | null>(null);
  const [pending, setPending] = useState<{ p: Project; to: ProjectStatus } | null>(null);
  const [withReserve, setWithReserve] = useState(false);

  const projects = data ?? [];
  const canMove = !!me && can(me, "project.status");
  const dragged = projects.find((p) => p.prjId === dragId) ?? null;

  const byCol = useMemo(() => {
    const m = new Map<ProjectStatus, Project[]>();
    for (const c of COLUMNS) m.set(c.key, projects.filter((p) => p.status === c.key || c.also?.includes(p.status)));
    return m;
  }, [projects]);

  function replace(np: Project) {
    setData((xs) => (xs ?? []).map((x) => (x.prjId === np.prjId ? np : x)));
  }

  async function drop(to: ProjectStatus) {
    setOverCol(null);
    const p = dragged;
    setDragId(null);
    if (!p || p.status === to || !canTransition(p.status, to)) return;
    if (noteRequired(to) || (to === "SELECTED" && selectionWarnings(p).length)) {
      setPending({ p, to });
      return;
    }
    try {
      replace(await api<Project>(`/api/projects/${p.prjId}/status`, { body: { to, updAt: p.updAt } }));
      toast(`${p.prjNm} → ${STATUS_LABEL[to]}`);
    } catch (e) {
      toastError(errMessage(e));
    }
  }

  function onDragOver(e: DragEvent, to: ProjectStatus) {
    if (dragged && canTransition(dragged.status, to)) {
      e.preventDefault();
      setOverCol(to);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Selection board"
        title="선정 보드"
        description={
          canMove
            ? "카드를 끌어 다른 열에 놓으면 상태가 바뀝니다. 오른쪽 패널에서 상·중·하와 과제 유형이 고르게 선정됐는지 확인하세요."
            : "선정 진행 현황입니다. 오른쪽 패널에서 상·중·하와 과제 유형의 균형을 확인할 수 있습니다."
        }
      />
      {error && <Callout tone="danger">{error}</Callout>}
      <div className={s.layout}>
        <div className={s.board}>
          {COLUMNS.map((col) => {
            const items = byCol.get(col.key) ?? [];
            const droppable = !!dragged && dragged.status !== col.key && canTransition(dragged.status, col.key);
            return (
              <section
                key={col.key}
                className={`${s.col} ${droppable ? s.colDroppable : ""} ${overCol === col.key ? s.colOver : ""} ${dragged && !droppable && dragged.status !== col.key ? s.colDisabled : ""}`}
                data-status={col.key}
                onDragOver={(e) => onDragOver(e, col.key)}
                onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
                onDrop={(e) => (e.preventDefault(), drop(col.key))}
              >
                <header className={s.colHead}>
                  <span className={s.colTitle}>
                    {STATUS_LABEL[col.key]}
                    <span className={s.colCount}>{items.length}</span>
                  </span>
                  <span className={s.colHint}>{col.hint}</span>
                </header>
                <div className={s.cards}>
                  {loading && !data && <Skeleton h={110} />}
                  {items.map((p) => (
                    <article
                      key={p.prjId}
                      className={`${s.card} ${dragId === p.prjId ? s.cardDragging : ""}`}
                      draggable={canMove}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", p.prjId);
                        setDragId(p.prjId);
                      }}
                      onDragEnd={() => (setDragId(null), setOverCol(null))}
                    >
                      <div className={s.cardTop}>
                        <span className="subtle num" style={{ fontSize: 11.5 }}>
                          {p.prjId}
                        </span>
                        <FitPair finalFit={p.finalFit} suggestFit={p.suggestFit} size="sm" />
                      </div>
                      <Link href={`/projects/${p.prjId}`} className={s.cardTitle} draggable={false}>
                        {p.prjNm}
                      </Link>
                      {criteria && <ProfileStrip profile={buildProfile(criteria, p.eval.answers)} size="sm" />}
                      <div className={s.cardChips}>
                        {p.devTypeCd && <Chip tone="outline">{labelOf(codes?.workAreas, p.devTypeCd)}</Chip>}
                        {p.sysTypeCd && <Chip tone="outline">{labelOf(codes?.sysTypes, p.sysTypeCd)}</Chip>}
                        {p.mainLangCd && <Chip tone="outline">{labelOf(codes?.langs, p.mainLangCd)}</Chip>}
                        {p.status === "SUPPLEMENT" && <Chip tone="warn">보완요청</Chip>}
                      </div>
                      <div className={s.cardFoot}>
                        <span className="subtle" style={{ fontSize: 12 }}>
                          {p.pmUserNm}
                        </span>
                        <AgreementSeal ax={p.axAgree} hx={p.hxAgree} />
                      </div>
                    </article>
                  ))}
                  {!loading && items.length === 0 && <div className={s.emptyCol}>{droppable ? "여기에 놓기" : "없음"}</div>}
                </div>
              </section>
            );
          })}
        </div>
        {criteria && codes && (
          <BalancePanel projects={projects} criteria={criteria} codes={codes} withReserve={withReserve} onToggleReserve={setWithReserve} />
        )}
      </div>

      {pending && (
        <StatusDialog
          open
          project={pending.p}
          initialTo={pending.to}
          onClose={() => setPending(null)}
          onDone={(np) => (replace(np), setPending(null))}
        />
      )}
    </>
  );
}
