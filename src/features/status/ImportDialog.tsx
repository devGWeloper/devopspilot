"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Callout } from "@/components/ui/Panel";
import { api, ApiError, errMessage } from "@/lib/apiClient";
import type { ImportSummary } from "@/lib/projects/service";
import type { ParseError } from "@/lib/projects/xlsxImport";
import b from "../common/board.module.css";

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<{ message: string; rows: ParseError[] } | null>(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      setDone(await api<ImportSummary>("/api/projects/import", { form }));
      router.refresh();
    } catch (e) {
      setError({ message: errMessage(e), rows: e instanceof ApiError && Array.isArray(e.details) ? (e.details as ParseError[]) : [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      wide
      title="엑셀 올리기"
      onClose={onClose}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            닫기
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>취소</Button>
            <Button variant="primary" loading={busy} disabled={!file} onClick={upload}>
              올리기
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Callout tone="ok">
            과제 신규 {done.projectsNew} · 갱신 {done.projectsUpdated}, 요구사항 신규 {done.reqsNew} · 갱신 {done.reqsUpdated}
          </Callout>
          {done.unknownOwners.length > 0 && (
            <Callout tone="warn">
              계정과 이름이 맞지 않는 참여 인력: <b>{done.unknownOwners.join(", ")}</b> — 시스템 관리 &gt; 계정에서 같은 이름으로 만들거나, 요구사항 편집에서 담당을 지정해 주세요.
            </Callout>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="muted">
            양식의 <b>과제·요구사항</b> 시트를 읽습니다. 한 행 = 요구사항 1건이며, <b>REQ-03 대표 업무 유형</b>이 첫 단계, <b>REQ-06</b>이 그 단계의 기준 M/D,{" "}
            <b>REF-01</b>의 첫 사람이 담당이 됩니다.
          </p>
          <ul className={b.small} style={{ margin: 0, paddingLeft: 18, color: "var(--muted)" }}>
            <li>같은 과제명은 같은 과제, 같은 요구사항 ID 는 정보만 갱신합니다 (화면에서 나눈 단계·담당은 유지).</li>
            <li>오류 행이 하나라도 있으면 아무것도 저장하지 않습니다.</li>
          </ul>
          <input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {error && (
            <Callout tone="danger">
              {error.message}
              {error.rows.length > 0 && (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {error.rows.slice(0, 30).map((r, i) => (
                    <li key={i}>
                      {r.rowNo ? `${r.rowNo}행: ` : ""}
                      {r.message}
                    </li>
                  ))}
                </ul>
              )}
            </Callout>
          )}
        </div>
      )}
    </Modal>
  );
}
