"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Callout, Panel, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Segmented } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { invalidateRefs } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/labels";
import type { Criteria } from "@/lib/types";
import s from "./criteria.module.css";
import { DetailEditor } from "./DetailEditor";
import { PublishDialog } from "./PublishDialog";
import { RuleEditor } from "./RuleEditor";
import { TierBoard } from "./TierBoard";
import { VersionList } from "./VersionList";

interface Loaded {
  draft: Criteria;
  published: Criteria;
  dirty: boolean;
}

export function CriteriaAdmin() {
  const { refreshMeta } = useAuth();
  const { toast, toastError } = useToast();
  const [data, setData] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<Criteria | null>(null);
  const [view, setView] = useState<"tier" | "detail">("tier");
  const [unsaved, setUnsaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [justPublished, setJustPublished] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const d = await api<Loaded>("/api/admin/criteria");
      setData(d);
      setDraft(d.draft);
      setUnsaved(false);
    } catch (e) {
      setError(errMessage(e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const stats = useMemo(() => {
    const inds = draft?.areas.flatMap((a) => a.indicators) ?? [];
    return { total: inds.length, major: inds.filter((i) => i.tier === "MAJOR").length };
  }, [draft]);

  function change(c: Criteria) {
    setDraft(c);
    setUnsaved(true);
  }

  async function saveDraft(quiet = false) {
    if (!draft) return false;
    setBusy(true);
    try {
      const saved = await api<Criteria>("/api/admin/criteria", { method: "PUT", body: draft });
      setDraft(saved);
      setUnsaved(false);
      setData((d) => (d ? { ...d, draft: saved, dirty: true } : d));
      if (!quiet) toast("초안을 저장했습니다. 게시 전까지 과제 판정에는 반영되지 않습니다.");
      return true;
    } catch (e) {
      toastError(errMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function openPublish() {
    if (unsaved && !(await saveDraft(true))) return;
    setPublishOpen(true);
  }

  async function reevaluate() {
    setBusy(true);
    try {
      const r = await api<{ changed: number }>("/api/admin/reevaluate", { method: "POST" });
      toast(`재판정 완료 — ${r.changed}건 갱신`);
      setJustPublished(null);
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!data || !draft) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Skeleton h={28} w={240} />
        <Skeleton h={420} />
      </div>
    );
  }

  const pub = data.published;

  return (
    <>
      <PageHeader
        eyebrow="Evaluation criteria"
        title="평가 기준"
        description="적합도 판정에 쓰이는 지표와 Major/Minor 구분, 판정 규칙을 관리합니다. 수정 내용은 초안으로 저장되고, 게시해야 과제 판정에 반영됩니다."
        actions={
          <>
            <Button loading={busy && !publishOpen} disabled={!unsaved} onClick={() => saveDraft()}>
              초안 저장
            </Button>
            <Button variant="primary" icon="send" onClick={openPublish} disabled={busy || (!unsaved && !data.dirty)}>
              게시
            </Button>
          </>
        }
      >
        <div className={s.statusBar}>
          <Chip tone="accent">게시본 v{pub.version}</Chip>
          <span className="muted">
            {pub.publishedAt ? `${fmtDateTime(pub.publishedAt)} · ${pub.publishedBy ?? ""}` : "초기 기준"}
          </span>
          {(unsaved || data.dirty) && <Chip tone="warn" dot>{unsaved ? "저장 안 된 변경" : "게시 전 초안 있음"}</Chip>}
          <span className={s.statusStats}>
            지표 <b className="num">{stats.total}</b> · Major <b className="num">{stats.major}</b> · Minor{" "}
            <b className="num">{stats.total - stats.major}</b>
          </span>
        </div>
      </PageHeader>

      {justPublished && (
        <div style={{ marginBottom: 16 }}>
          <Callout tone="ok">
            평가 기준 v{justPublished} 을(를) 게시했습니다. 기존 과제의 참고 등급는 재판정해야 새 기준으로 바뀝니다(확정 적합도는 그대로 유지).{" "}
            <Button size="sm" variant="primary" loading={busy} onClick={reevaluate} style={{ marginLeft: 8 }}>
              지금 재판정
            </Button>
          </Callout>
        </div>
      )}

      <div className={s.layout}>
        <div className={s.main}>
          <Panel
            eyebrow="Indicators"
            title="지표"
            actions={
              <Segmented
                ariaLabel="보기"
                value={view}
                onChange={setView}
                options={[
                  { key: "tier", label: "Major/Minor 분류" },
                  { key: "detail", label: "지표·선택지 편집" },
                ]}
              />
            }
          >
            {view === "tier" ? <TierBoard criteria={draft} onChange={change} /> : <DetailEditor criteria={draft} onChange={change} />}
          </Panel>
        </div>
        <aside className={s.side}>
          <Panel eyebrow="Judgement rule" title="판정 규칙">
            <RuleEditor criteria={draft} onChange={change} />
          </Panel>
          <Panel eyebrow="Versions" title="게시 이력">
            <VersionList key={pub.version} />
          </Panel>
        </aside>
      </div>

      <PublishDialog
        open={publishOpen}
        draft={draft}
        currentVersion={pub.version}
        onClose={() => setPublishOpen(false)}
        onPublished={async (v) => {
          setPublishOpen(false);
          setJustPublished(v);
          invalidateRefs();
          await refreshMeta();
          await load();
        }}
      />
    </>
  );
}
