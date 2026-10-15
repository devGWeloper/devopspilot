"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import type { ProjectPatch } from "@/lib/projects/service";
import { PRJ_KINDS, type PrjKind } from "@/lib/types";
import type { ProjectInfo } from "@/lib/views";

const FIELDS: [keyof ProjectPatch, string][] = [
  ["prjNm", "과제명 (PRJ-01)"],
  ["sysNm", "대상 시스템명 (PRJ-02)"],
  ["deptCd", "하이닉스 담당 (PRJ-03)"],
  ["teamNm", "담당 팀 (PRJ-04)"],
  ["pmNm", "작성자 PM (PRJ-05)"],
  ["axTeam", "SK AX 소속팀"],
];

export function ProjectDialog({ info, onClose }: { info: ProjectInfo | null; onClose: () => void }) {
  const router = useRouter();
  const { toast, toastError } = useToast();
  const [f, setF] = useState<ProjectPatch>({
    prjNm: info?.prjNm ?? "",
    sysNm: info?.sysNm ?? "",
    kind: info?.kind ?? "개발",
    deptCd: info?.deptCd ?? "",
    teamNm: info?.teamNm ?? "",
    axTeam: info?.axTeam ?? "",
    pmNm: info?.pmNm ?? "",
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      if (info) await api(`/api/projects/${info.prjId}`, { method: "PUT", body: { expectedUpdAt: info.updAt, patch: f } });
      else await api("/api/projects", { body: f });
      toast(info ? "과제 정보를 고쳤습니다." : "과제를 추가했습니다. 요구사항을 넣어 주세요.");
      router.refresh();
      onClose();
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={info ? `과제 수정 — ${info.prjNm}` : "과제 추가"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>취소</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            저장
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {FIELDS.map(([k, label]) => (
          <Field key={k} label={label} required={k === "prjNm"}>
            <TextInput value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </Field>
        ))}
        <Field label="구분" hint="운영 과제 = SR·장애 대응 위주">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as PrjKind })}>
            {PRJ_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
