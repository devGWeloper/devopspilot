"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Callout } from "@/components/ui/Panel";
import { api, ApiError, errMessage } from "@/lib/apiClient";
import type { ImportSummary, WbError } from "@/lib/projects/service";
import b from "../common/board.module.css";

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<{ message: string; rows: WbError[] } | null>(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      setDone(await api<ImportSummary>("/api/master/import", { form }));
      router.refresh();
    } catch (e) {
      setError({ message: errMessage(e), rows: e instanceof ApiError && Array.isArray(e.details) ? (e.details as WbError[]) : [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      wide
      title="기준정보 엑셀 올리기"
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
            과제 신규 {done.projectsNew} · 갱신 {done.projectsUpdated} / 요구사항·단계 신규 {done.tagsNew} · 갱신 {done.tagsUpdated} / 담당 매핑 {done.mapped} / 계정 신규 {done.usersNew} · 갱신 {done.usersUpdated} / 등급 단가 {done.grades} · 토큰 단가 {done.tokens}
          </Callout>
          {done.newPasswords.length > 0 && (
            <Callout tone="warn">
              새 계정의 초기 비밀번호입니다. <b>이 창을 닫으면 다시 볼 수 없습니다.</b> 본인에게 전달하고 &apos;내 정보&apos;에서 바꾸도록 안내해 주세요.
              <table className={b.tbl} style={{ marginTop: 8 }}>
                <tbody>
                  {done.newPasswords.map((p) => (
                    <tr key={p.userId}>
                      <td>{p.userId}</td>
                      <td>{p.userNm}</td>
                      <td>
                        <code>{p.password}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Callout>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="muted">
            <b>생산성 측정 PoC 데이터</b> 엑셀(01. 과제 · 02. 요구사항-SDLC · 03. 공수 태그 매핑 · 04. 기준정보)을 읽습니다. 있는 시트만 읽고, 05. 주요 집계 로직은 참고용이라 읽지 않습니다.
          </p>
          <ul className={b.small} style={{ margin: 0, paddingLeft: 18, color: "var(--muted)" }}>
            <li>파일에 있는 과제·태그·계정은 파일 값으로 고치고, 파일에 없는 것은 그대로 둡니다(삭제는 화면에서).</li>
            <li>공수 태그 열은 과제 ID-요구사항 ID-단계와 같아야 합니다. 요구사항·단계 하나에 담당 사번 하나입니다.</li>
            <li>단가 표는 값을 적은 줄만 반영합니다. 오류가 하나라도 있으면 아무것도 저장하지 않습니다.</li>
          </ul>
          <input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {error && (
            <Callout tone="danger">
              {error.message}
              {error.rows.length > 0 && (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {error.rows.slice(0, 40).map((r, i) => (
                    <li key={i}>
                      {r.sheet}
                      {r.rowNo ? ` ${r.rowNo}행` : ""}: {r.message}
                    </li>
                  ))}
                  {error.rows.length > 40 && <li>외 {error.rows.length - 40}건</li>}
                </ul>
              )}
            </Callout>
          )}
        </div>
      )}
    </Modal>
  );
}
