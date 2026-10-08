"use client";

import { useState } from "react";
import type { Me } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/Panel";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { can } from "@/lib/auth/permissions";
import { kstDate } from "@/lib/measure/csv";
import { PHASE_LABEL, PHASES, type Defect, type Phase } from "@/lib/measure/types";
import type { MeasureData } from "./MeasureTab";
import s from "./tab.module.css";

export function DefectForm({
  prjId,
  wbsIds,
  onClose,
  onSaved,
}: {
  prjId: string;
  wbsIds: { wbsId: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast, toastError } = useToast();
  const [d, setD] = useState({ wbsId: wbsIds[0]?.wbsId ?? "", defectId: "", foundDt: kstDate(Date.now()), phase: "UNIT" as Phase, cause: "", severity: "NORMAL" as Defect["severity"], title: "", testCaseRef: "" });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof d>) => setD((x) => ({ ...x, ...patch }));

  async function save() {
    setBusy(true);
    try {
      await api(`/api/measure/${prjId}/defects`, { body: d });
      toast(`결함 ${d.defectId} 을(를) 등록했습니다.`);
      onSaved();
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="결함 등록"
      eyebrow="Replay 테스트 결함 — 당시 테스트케이스 기준"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" loading={busy} disabled={!d.defectId.trim() || !d.title.trim() || !d.wbsId} onClick={save}>
            등록
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="결함 ID" required>
          <TextInput value={d.defectId} onChange={(e) => set({ defectId: e.target.value })} placeholder="QA-123" />
        </Field>
        <Field label="기능 (WBS-ID)" required>
          <Select value={d.wbsId} onChange={(e) => set({ wbsId: e.target.value })}>
            {wbsIds.map((w) => (
              <option key={w.wbsId} value={w.wbsId}>
                {w.wbsId} {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="제목" required>
            <TextInput value={d.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
        </div>
        <Field label="발견일">
          <TextInput type="date" value={d.foundDt} onChange={(e) => set({ foundDt: e.target.value })} />
        </Field>
        <Field label="발견 단계">
          <Select value={d.phase} onChange={(e) => set({ phase: e.target.value as Phase })}>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="심각도">
          <Select value={d.severity} onChange={(e) => set({ severity: e.target.value as Defect["severity"] })}>
            <option value="NORMAL">일반</option>
            <option value="CRITICAL">치명</option>
          </Select>
        </Field>
        <Field label="테스트케이스">
          <TextInput value={d.testCaseRef} onChange={(e) => set({ testCaseRef: e.target.value })} placeholder="TC-012" />
        </Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="원인">
            <TextInput value={d.cause} onChange={(e) => set({ cause: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export function DefectList({ data, me, onChanged }: { data: MeasureData; me: Me; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const canAdd = can(me, "measure.defect", { project: data.project });
  const list = [...data.input.defects].sort((a, b) => b.foundDt.localeCompare(a.foundDt));
  return (
    <div>
      {list.length === 0 ? (
        <EmptyState icon="bug" title="등록된 결함이 없습니다" />
      ) : (
        <table className={s.mini}>
          <thead>
            <tr>
              <th>ID</th>
              <th>기능</th>
              <th>제목</th>
              <th>심각도</th>
              <th>발견일</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.defectId}>
                <td className="num">{d.defectId}</td>
                <td className="num subtle">{d.wbsId}</td>
                <td>{d.title}</td>
                <td>{d.severity === "CRITICAL" ? <Chip tone="danger">치명</Chip> : <Chip>일반</Chip>}</td>
                <td className="num subtle">{d.foundDt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canAdd && (
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--line)" }}>
          <Button size="sm" icon="plus" onClick={() => setOpen(true)}>
            결함 등록
          </Button>
        </div>
      )}
      {open && (
        <DefectForm
          prjId={data.project.prjId}
          wbsIds={data.input.features.map((f) => ({ wbsId: f.wbsId, name: f.name }))}
          onClose={() => setOpen(false)}
          onSaved={() => (setOpen(false), onChanged())}
        />
      )}
    </div>
  );
}
