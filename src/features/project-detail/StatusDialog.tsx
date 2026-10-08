"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Callout } from "@/components/ui/Panel";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { STATUS_LABEL } from "@/lib/labels";
import { canTransition, noteRequired } from "@/lib/projects/transitions";
import { STATUSES, type Project, type ProjectStatus } from "@/lib/types";
import ui from "@/components/ui/ui.module.css";

export function selectionWarnings(p: Project): string[] {
  const w: string[] = [];
  if (p.finalFit === "NA") w.push("적합도가 아직 확정되지 않았습니다.");
  if (p.hxAgree !== "AGREE") w.push("SK hynix 동의가 기록되지 않았습니다.");
  return w;
}

export function StatusDialog({
  open,
  project,
  initialTo,
  onClose,
  onDone,
}: {
  open: boolean;
  project: Project;
  initialTo?: ProjectStatus;
  onClose: () => void;
  onDone: (p: Project) => void;
}) {
  const { toast, toastError } = useToast();
  const targets = STATUSES.filter((t) => canTransition(project.status, t));
  const [to, setTo] = useState<ProjectStatus | null>(initialTo ?? targets[0] ?? null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTo(initialTo ?? targets[0] ?? null);
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTo]);

  async function save() {
    if (!to) return;
    setBusy(true);
    try {
      const np = await api<Project>(`/api/projects/${project.prjId}/status`, { body: { to, note, updAt: project.updAt } });
      toast(`상태를 '${STATUS_LABEL[to]}'(으)로 변경했습니다.`);
      onDone(np);
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const warns = to === "SELECTED" ? selectionWarnings(project) : [];

  return (
    <Modal
      open={open}
      title="상태 변경"
      eyebrow={`${project.prjId} · 현재 ${STATUS_LABEL[project.status]}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" loading={busy} disabled={!to || (noteRequired(to) && !note.trim())} onClick={save}>
            변경
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div role="radiogroup" aria-label="변경할 상태" className={ui.radioGroup}>
          {targets.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={to === t} className={ui.radioCard} onClick={() => setTo(t)}>
              <span className={ui.radioMark} />
              <span className={ui.radioLabel}>{STATUS_LABEL[t]}</span>
            </button>
          ))}
        </div>
        {warns.length > 0 && (
          <Callout tone="warn">
            선정 전에 확인하세요 — {warns.join(" ")}
            <br />
            그대로 진행해도 됩니다(합의 회의 현장 처리).
          </Callout>
        )}
        <Field label="사유" required={!!to && noteRequired(to)} hint={to && noteRequired(to) ? "PM 에게 그대로 보여집니다." : "선택 입력"}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </Field>
      </div>
    </Modal>
  );
}
