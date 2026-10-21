"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { FIELD_BY_ID } from "@/lib/projects/form";
import type { ProjectPatch } from "@/lib/projects/service";
import type { ProjectInfo } from "@/lib/views";

type Key = Exclude<keyof ProjectPatch, "prjId">;

// 기준정보 엑셀 '01. 과제' 열 순서. 선택값은 선정 현황 항목(form.ts)과 같게.
// 하이닉스 조직은 개편이 잦아 선택지로 묶지 않고 직접 적는다.
const FIELDS: [Key, string, string | null][] = [
  ["prjNm", "하이닉스 과제명", null],
  ["promisCd", "PROMIS 코드", null],
  ["sysNm", "대상 시스템명", null],
  ["deptCd", "하이닉스 담당", "PRJ-03"],
  ["teamNm", "하이닉스 담당 팀", null],
  ["axHq", "SK AX 소속 본부", null],
  ["axTeam", "SK AX 소속 팀", null],
  ["pmNm", "과제 PM", null],
  ["sysGrade", "시스템 등급", "PRJ-06"],
  ["deployType", "배포 형식", "PRJ-07"],
  ["area", "과제 영역", "PRJ-08"],
  ["vcs", "버전 관리 도구", "PRJ-10"],
  ["pms", "작업 관리 도구", "PRJ-11"],
];

export function ProjectDialog({ info, onClose }: { info: ProjectInfo | null; onClose: () => void }) {
  const router = useRouter();
  const { toast, toastError } = useToast();
  const [f, setF] = useState<ProjectPatch>({
    prjId: info?.prjId ?? "",
    prjNm: info?.prjNm ?? "",
    promisCd: info?.promisCd ?? "",
    sysNm: info?.sysNm ?? "",
    deptCd: info?.deptCd ?? "",
    teamNm: info?.teamNm ?? "",
    axHq: info?.axHq ?? "",
    axTeam: info?.axTeam ?? "",
    pmNm: info?.pmNm ?? "",
    sysGrade: info?.sysGrade ?? "",
    deployType: info?.deployType ?? "",
    area: info?.area ?? "",
    vcs: info?.vcs ?? "",
    pms: info?.pms ?? "",
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      if (info) await api(`/api/projects/${info.prjId}`, { method: "PUT", body: { expectedUpdAt: info.updAt, patch: f } });
      else await api("/api/projects", { body: f });
      toast(info ? "과제 정보를 고쳤습니다." : "과제를 추가했습니다. 02 요구사항-SDLC 탭에서 요구사항·단계를 넣어 주세요.");
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
      wide
      title={info ? `과제 수정 — ${info.prjId}` : "과제 추가"}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Field label="과제 ID" required hint={info ? "공수 태그 앞자리라 바꿀 수 없음" : "예: DAE01 — 영문·숫자, 하이픈 불가"}>
          <TextInput value={f.prjId} disabled={!!info} onChange={(e) => setF({ ...f, prjId: e.target.value.trim() })} />
        </Field>
        {FIELDS.map(([k, label, opt]) => {
          const options = opt ? FIELD_BY_ID[opt]?.options : undefined;
          const v = String(f[k] ?? "");
          return (
            <Field key={k} label={label} required={k === "prjNm"} hint={k === "teamNm" ? "직접 입력 — 예: 제조IT팀" : undefined}>
              {options ? (
                <Select value={v} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
                  <option value="">—</option>
                  {Array.from(new Set([...options, v].filter(Boolean))).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              ) : (
                <TextInput value={v} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              )}
            </Field>
          );
        })}
      </div>
    </Modal>
  );
}
