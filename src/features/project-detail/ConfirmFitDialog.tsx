"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FitBadge } from "@/components/ui/FitBadge";
import { Field, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import ui from "@/components/ui/ui.module.css";
import { api, errMessage } from "@/lib/apiClient";
import { FIT_LABEL } from "@/lib/labels";
import { LEVELS, type Level, type Project } from "@/lib/types";

export function ConfirmFitDialog({
  open,
  project,
  initialFit,
  initialReason,
  onClose,
  onDone,
}: {
  open: boolean;
  project: Project;
  initialFit?: Level;
  initialReason?: string;
  onClose: () => void;
  onDone: (p: Project) => void;
}) {
  const { toast, toastError } = useToast();
  const suggest = project.suggestFit === "NA" ? null : project.suggestFit;
  const [fit, setFit] = useState<Level>(initialFit ?? (project.finalFit !== "NA" ? project.finalFit : suggest ?? "M"));
  const [reason, setReason] = useState(initialReason ?? project.eval.confirm?.reason ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFit(initialFit ?? (project.finalFit !== "NA" ? project.finalFit : suggest ?? "M"));
    setReason(initialReason ?? project.eval.confirm?.reason ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const needReason = fit !== suggest;

  async function save() {
    setBusy(true);
    try {
      const np = await api<Project>(`/api/projects/${project.prjId}/confirm`, { body: { fit, reason, updAt: project.updAt } });
      toast(`적합도를 '${FIT_LABEL[fit]}'(으)로 확정했습니다.`);
      onDone(np);
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      const np = await api<Project>(`/api/projects/${project.prjId}/confirm?updAt=${encodeURIComponent(project.updAt)}`, { method: "DELETE" });
      toast("확정을 취소했습니다.");
      onDone(np);
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="적합도 확정"
      eyebrow={project.prjId}
      onClose={onClose}
      footer={
        <>
          {project.finalFit !== "NA" && (
            <Button variant="danger" onClick={clear} disabled={busy} style={{ marginRight: "auto" }}>
              확정 취소
            </Button>
          )}
          <Button onClick={onClose}>닫기</Button>
          <Button variant="primary" loading={busy} disabled={needReason && !reason.trim()} onClick={save}>
            확정
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }} className="muted">
          판정 규칙 제안 <FitBadge fit={project.suggestFit} confirmed={false} size="sm" />
        </div>
        <div role="radiogroup" aria-label="확정 적합도" className={ui.radioGroup}>
          {LEVELS.map((lv) => (
            <button key={lv} type="button" role="radio" aria-checked={fit === lv} className={ui.radioCard} onClick={() => setFit(lv)}>
              <span className={ui.radioMark} />
              <span className={ui.radioLabel}>
                <FitBadge fit={lv} size="sm" />
                {lv === suggest && <span className="subtle" style={{ fontWeight: 500, fontSize: 12 }}>제안</span>}
              </span>
            </button>
          ))}
        </div>
        <Field label="확정 사유" required={needReason} hint={needReason ? "제안과 다르게 확정하므로 사유가 필요합니다." : "선택 입력"}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
        </Field>
      </div>
    </Modal>
  );
}
