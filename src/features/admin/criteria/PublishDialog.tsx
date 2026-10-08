"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FitBadge } from "@/components/ui/FitBadge";
import { Modal } from "@/components/ui/Modal";
import { Callout, Skeleton } from "@/components/ui/Panel";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import type { Impact } from "@/lib/criteria/validate";
import { FIT_COLOR, FIT_LABEL } from "@/lib/labels";
import { FITS, type Criteria } from "@/lib/types";
import s from "./criteria.module.css";

export function PublishDialog({
  open,
  draft,
  currentVersion,
  onClose,
  onPublished,
}: {
  open: boolean;
  draft: Criteria;
  currentVersion: number;
  onClose: () => void;
  onPublished: (v: number) => void;
}) {
  const { toastError } = useToast();
  const [preview, setPreview] = useState<{ errors: string[]; impact: Impact } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    api<{ errors: string[]; impact: Impact }>("/api/admin/criteria/preview", { body: draft })
      .then(setPreview)
      .catch((e) => toastError(errMessage(e)));
  }, [open, draft, toastError]);

  async function publish() {
    setBusy(true);
    try {
      const c = await api<Criteria>("/api/admin/criteria/publish", { method: "POST" });
      onPublished(c.version);
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      wide
      eyebrow={`v${currentVersion} → v${currentVersion + 1}`}
      title="평가 기준 게시"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" loading={busy} disabled={!preview || preview.errors.length > 0} onClick={publish}>
            v{currentVersion + 1} 게시
          </Button>
        </>
      }
    >
      {!preview ? (
        <Skeleton h={200} />
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {preview.errors.length > 0 && (
            <Callout tone="danger">
              게시하려면 아래를 고쳐 주세요.
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {preview.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Callout>
          )}
          <div>
            <span className="eyebrow">제안 적합도 변화 (제외 과제 제외)</span>
            <div className={s.impact}>
              {FITS.map((f) => {
                const a = preview.impact.from[f];
                const b = preview.impact.to[f];
                return (
                  <div key={f} className={s.impactCell}>
                    <span style={{ color: FIT_COLOR[f], fontWeight: 700 }}>{FIT_LABEL[f]}</span>
                    <span className="num">
                      {a} → <b>{b}</b>
                    </span>
                    {a !== b && <span className={b > a ? s.up : s.down}>{b > a ? `+${b - a}` : b - a}</span>}
                  </div>
                );
              })}
            </div>
          </div>
          {preview.impact.changed.length > 0 ? (
            <div>
              <span className="eyebrow">판정이 바뀌는 과제 {preview.impact.changed.length}건</span>
              <ul className={s.changedList}>
                {preview.impact.changed.map((c) => (
                  <li key={c.prjId}>
                    <span className="subtle num">{c.prjId}</span>
                    <span>{c.prjNm}</span>
                    <span className={s.changedFits}>
                      <FitBadge fit={c.before} confirmed={false} size="sm" /> → <FitBadge fit={c.after} confirmed={false} size="sm" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="muted">이 변경으로 제안 적합도가 바뀌는 과제는 없습니다.</p>
          )}
          <Callout tone="info">
            게시 후 <b>재판정</b>을 실행해야 기존 과제의 제안 적합도가 갱신됩니다. AX 가 확정한 적합도는 바뀌지 않습니다.
          </Callout>
        </div>
      )}
    </Modal>
  );
}
