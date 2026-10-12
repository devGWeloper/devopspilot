"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AgreementSeal } from "@/components/ui/AgreementSeal";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/Chip";
import { FitBadge } from "@/components/ui/FitBadge";
import { Callout, Skeleton } from "@/components/ui/Panel";
import { ProfileStrip } from "@/components/ui/ProfileStrip";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { can } from "@/lib/auth/permissions";
import { evaluateFit, FIT_LABEL } from "@/lib/fitness";
import { useApi, useRefs } from "@/lib/hooks";
import { canTransition } from "@/lib/projects/transitions";
import { STATUSES, type Project } from "@/lib/types";
import { ConfirmFitDialog } from "./ConfirmFitDialog";
import s from "./detail.module.css";
import { EvaluationTab } from "./EvaluationTab";
import { HistoryTab } from "./HistoryTab";
import { OverviewTab } from "./OverviewTab";
import { RationaleTab } from "./RationaleTab";
import { ReviewTab } from "./ReviewTab";
import { StatusDialog } from "./StatusDialog";

export type DetailTab = "overview" | "eval" | "rationale" | "review" | "measure" | "ai" | "history";

export interface DetailSlots {
  measure?: (p: Project, reload: () => void) => ReactNode;
  ai?: (p: Project, reload: () => void) => ReactNode;
}

export function ProjectDetail({ id, slots = {} }: { id: string; slots?: DetailSlots }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { me, meta } = useAuth();
  const { criteria, codes } = useRefs();
  const { toast, toastError } = useToast();
  const { data: p, setData, error, reload } = useApi<Project>(`/api/projects/${id}`);
  const [dialog, setDialog] = useState<"status" | "confirm" | null>(null);
  const [busy, setBusy] = useState(false);

  const tab = (sp.get("tab") as DetailTab) || "overview";
  function setTab(t: DetailTab) {
    router.replace(`${pathname}?tab=${t}`, { scroll: false });
  }

  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!p || !criteria || !me) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Skeleton h={28} w={320} />
        <Skeleton h={140} />
        <Skeleton h={320} />
      </div>
    );
  }

  const ev = evaluateFit(criteria, p.eval.answers);
  const canEdit = can(me, "project.edit", { project: p });
  const canSubmit = can(me, "project.submit", { project: p });
  const canStatus = can(me, "project.status") && STATUSES.some((t) => canTransition(p.status, t));
  const canConfirm = can(me, "project.confirm");
  const stale = meta && p.critVer !== meta.criteriaVersion;

  const items: TabItem<DetailTab>[] = [
    { key: "overview", label: "개요" },
    { key: "eval", label: "지표 평가", count: p.answerCnt },
    { key: "rationale", label: "판정 근거" },
    { key: "review", label: "검토·합의", count: p.reviews.filter((r) => r.context === "SELECTION").length },
    ...(p.status === "SELECTED" && slots.measure ? [{ key: "measure" as const, label: "측정" }] : []),
    ...(me.role === "AX_ADMIN" && meta?.aiEnabled && slots.ai ? [{ key: "ai" as const, label: "AI 의견" }] : []),
    { key: "history", label: "이력" },
  ];

  async function submit() {
    setBusy(true);
    try {
      setData(await api<Project>(`/api/projects/${p!.prjId}/submit`, { body: { updAt: p!.updAt } }));
      toast("제출했습니다. AX 관리자 검토 후 결과를 알려 드립니다.");
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <nav className={s.crumb}>
        <Link href="/projects">과제 포트폴리오</Link>
        <span>/</span>
        <span>{p.prjId}</span>
      </nav>

      <header className={s.header}>
        <div className={s.headMain}>
          <div className={s.headMeta}>
            <span className="eyebrow">
              {p.prjId} · {p.sysNm || "시스템 미입력"}
            </span>
            <StatusChip status={p.status} />
          </div>
          <h1 className="h1">{p.prjNm}</h1>
          <div className={s.headFacts}>
            <span>
              PM <b>{p.pmUserNm}</b>
            </span>
            <span className={s.dot} />
            <span>
              응답 <b className="num">{p.answerCnt}</b>/{p.indicatorCnt}
            </span>
            <span className={s.dot} />
            <AgreementSeal ax={p.axAgree} hx={p.hxAgree} />
          </div>
          <div className={s.headProfile}>
            <ProfileStrip profile={ev.profile} size="lg" />
            <span className="muted" style={{ fontSize: 12.5 }}>
              {ev.ruleText}
            </span>
          </div>
        </div>
        <div className={s.headSide}>
          <div className={s.fitBox}>
            {p.finalFit !== "NA" ? <FitBadge fit={p.finalFit} size="lg" /> : <FitBadge fit={p.suggestFit} confirmed={false} size="lg" />}
            <div className={s.fitText}>
              <span className="eyebrow">적합도</span>
              {p.finalFit !== "NA" ? (
                <span>
                  확정{p.finalFit !== p.suggestFit && p.suggestFit !== "NA" ? <span className="subtle"> · 참고 등급과 다름</span> : null}
                </span>
              ) : (
                <span className="muted">{p.suggestFit === "NA" ? "Major 지표 응답 필요" : "참고 등급 — AX 확정 전"}</span>
              )}
              <span className="subtle" style={{ fontSize: 12 }}>
                PM 판단 {p.base.pmFit ? FIT_LABEL[p.base.pmFit] : "미입력"}
              </span>
            </div>
          </div>
          <div className={`${s.actions} no-print`}>
            {canEdit && (
              <Button icon="edit" onClick={() => router.push(`/entry/${p.prjId}`)}>
                편집
              </Button>
            )}
            {canSubmit && (
              <Button variant="primary" icon="send" loading={busy} onClick={submit}>
                제출
              </Button>
            )}
            {canConfirm && (
              <Button onClick={() => setDialog("confirm")} disabled={p.suggestFit === "NA" && p.finalFit === "NA"}>
                적합도 확정
              </Button>
            )}
            {canStatus && (
              <Button variant="primary" onClick={() => setDialog("status")}>
                상태 변경
              </Button>
            )}
          </div>
        </div>
      </header>

      {p.statusNote && (p.status === "SUPPLEMENT" || p.status === "EXCLUDED") && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone={p.status === "SUPPLEMENT" ? "warn" : "danger"}>
            <b>{p.status === "SUPPLEMENT" ? "보완 요청" : "제외 사유"}</b> — {p.statusNote}
          </Callout>
        </div>
      )}
      {stale && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="info">
            이 과제는 평가 기준 v{p.critVer} 로 판정되었습니다. 현재 게시된 기준은 v{meta!.criteriaVersion} 입니다.
            {me.role === "AX_ADMIN" && " 평가 기준 화면에서 재판정을 실행하면 최신 기준이 반영됩니다."}
          </Callout>
        </div>
      )}

      <Tabs items={items} value={items.some((i) => i.key === tab) ? tab : "overview"} onChange={setTab} />
      <div className={s.tabBody}>
        {tab === "overview" && <OverviewTab p={p} codes={codes} criteria={criteria} />}
        {tab === "eval" && <EvaluationTab p={p} criteria={criteria} />}
        {tab === "rationale" && <RationaleTab p={p} criteria={criteria} />}
        {tab === "review" && <ReviewTab p={p} me={me} onChange={setData} context="SELECTION" />}
        {tab === "measure" && slots.measure?.(p, reload)}
        {tab === "ai" && slots.ai?.(p, reload)}
        {tab === "history" && <HistoryTab prjId={p.prjId} key={p.updAt} />}
      </div>

      <StatusDialog open={dialog === "status"} project={p} onClose={() => setDialog(null)} onDone={(np) => (setData(np), setDialog(null))} />
      <ConfirmFitDialog open={dialog === "confirm"} project={p} onClose={() => setDialog(null)} onDone={(np) => (setData(np), setDialog(null))} />
    </>
  );
}
