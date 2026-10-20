"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Callout } from "@/components/ui/Panel";
import { api, download, errMessage } from "@/lib/apiClient";
import b from "../common/board.module.css";
import { useMutate } from "../common/useMutate";

/** 텔레메트리를 못 쓰는 PC 용 — 로컬 로그에서 세션 시간을 뽑아 올린다 */
export function UploadDialog({ onClose }: { onClose: () => void }) {
  const { run, busy } = useMutate();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ sessions: number; warnings: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setErr(null);
    const form = new FormData();
    form.append("file", file);
    await run(async () => {
      setResult(await api("/api/effort/upload", { form }));
    });
  }

  return (
    <Modal
      open
      title="Codex 기록 올리기"
      onClose={onClose}
      footer={
        result ? (
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
      {result ? (
        <Callout tone="ok">
          세션 {result.sessions}건을 반영했습니다. 공수 태그로 요구사항·단계를 정하지 못한 세션은 그날 화면의 &apos;어느 요구사항 작업인지 모르는 Codex 사용&apos;에 나타납니다.
          {result.warnings.length > 0 && <div className={b.xs}>경고 {result.warnings.length}건: {result.warnings.slice(0, 3).join(" / ")}</div>}
        </Callout>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p className="muted">
            텔레메트리가 연결되지 않은 PC 에서 씁니다. 스크립트가 Codex 로컬 로그(~/.codex/sessions)를 읽어 <b>세션별 사용 시간·토큰과 공수 태그 후보</b>만 JSON 으로 만듭니다(대화 원문은 담지 않음).
          </p>
          <ol className={b.small} style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <button className={b.lnk} onClick={() => download("/api/scripts/collect_ai_usage.py", "collect_ai_usage.py").catch((e) => setErr(errMessage(e)))}>
                collect_ai_usage.py 내려받기
              </button>
            </li>
            <li>
              <code>py collect_ai_usage.py --since 2026-11-01</code> (macOS·Linux: python3)
            </li>
            <li>만들어진 ai_sessions_*.json 을 아래에서 올리기 — 같은 파일을 다시 올려도 중복되지 않습니다.</li>
          </ol>
          <input type="file" accept=".json,application/json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {err && <Callout tone="danger">{err}</Callout>}
        </div>
      )}
    </Modal>
  );
}
