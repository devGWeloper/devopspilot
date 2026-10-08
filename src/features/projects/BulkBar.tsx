"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { STATUS_LABEL } from "@/lib/labels";
import { noteRequired } from "@/lib/projects/transitions";
import type { ProjectStatus } from "@/lib/types";
import s from "./projects.module.css";

const TARGETS: ProjectStatus[] = ["REVIEW", "SUPPLEMENT", "SELECTED", "RESERVE", "EXCLUDED"];

export function BulkBar({
  count,
  onClear,
  onStatus,
  onConfirm,
}: {
  count: number;
  onClear: () => void;
  onStatus: (to: ProjectStatus, note?: string) => Promise<void>;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<ProjectStatus>("REVIEW");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    await fn();
    setBusy(false);
    setOpen(false);
    setNote("");
  }

  return (
    <>
      <div className={s.bulk} role="region" aria-label="일괄 작업">
        <span>
          <b className="num">{count}</b>건 선택
        </span>
        <span className={s.bulkSep} />
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className={s.bulkBtn}>
          상태 변경
        </Button>
        <Button size="sm" variant="ghost" loading={busy && !open} onClick={() => run(onConfirm)} className={s.bulkBtn}>
          제안대로 적합도 확정
        </Button>
        <Button size="sm" variant="ghost" icon="x" onClick={onClear} className={s.bulkBtn}>
          선택 해제
        </Button>
      </div>
      <Modal
        open={open}
        title={`${count}건 상태 변경`}
        eyebrow="Bulk update"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>취소</Button>
            <Button variant="primary" loading={busy} disabled={noteRequired(to) && !note.trim()} onClick={() => run(() => onStatus(to, note))}>
              변경
            </Button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <Field label="변경할 상태">
            <Select value={to} onChange={(e) => setTo(e.target.value as ProjectStatus)}>
              {TARGETS.map((t) => (
                <option key={t} value={t}>
                  {STATUS_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="사유" required={noteRequired(to)} hint="현재 상태에서 바꿀 수 없는 과제는 건너뛰고 결과를 알려 드립니다.">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
