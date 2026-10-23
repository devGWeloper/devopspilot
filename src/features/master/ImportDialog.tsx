"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Callout } from "@/components/ui/Panel";
import { api, ApiError, download, errMessage } from "@/lib/apiClient";
import type { ImportSummary, WbError } from "@/lib/projects/service";
import b from "../common/board.module.css";

const LIST_MAX = 12;

function Names({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className={b.small}>
      <b>{title}</b> {items.slice(0, LIST_MAX).join(", ")}
      {items.length > LIST_MAX && ` 외 ${items.length - LIST_MAX}건`}
    </div>
  );
}

function Counts({ s }: { s: ImportSummary }) {
  return (
    <table className={b.tbl}>
      <tbody>
        <tr>
          <th>과제</th>
          <td>
            신규 {s.projectsNew} · 갱신 {s.projectsUpdated}
          </td>
        </tr>
        <tr>
          <th>요구사항 × 단계</th>
          <td>
            신규 {s.tagsNew} · 갱신 {s.tagsUpdated}
          </td>
        </tr>
        <tr>
          <th>담당 매핑</th>
          <td>{s.mapped}</td>
        </tr>
        <tr>
          <th>개발자 계정</th>
          <td>
            신규 {s.usersNew} · 갱신 {s.usersUpdated}
          </td>
        </tr>
        <tr>
          <th>단가</th>
          <td>
            등급 {s.grades} · 토큰 {s.tokens}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** 엑셀 한 번으로 선정 현황·공수 입력·측정 결과가 모두 바뀌므로, 고르면 먼저 미리 보여 주고 '반영'을 눌러야 저장한다. */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const [done, setDone] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<{ message: string; rows: WbError[] } | null>(null);

  async function send(f: File, dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", f);
      if (dryRun) form.append("dryRun", "1");
      const r = await api<ImportSummary>("/api/master/import", { form });
      if (dryRun) setPreview(r);
      else {
        setDone(r);
        router.refresh();
      }
    } catch (e) {
      setPreview(null);
      setError({ message: errMessage(e), rows: e instanceof ApiError && Array.isArray(e.details) ? (e.details as WbError[]) : [] });
    } finally {
      setBusy(false);
    }
  }

  function pick(f: File | null) {
    setFile(f);
    setPreview(null);
    if (f) void send(f, true);
  }

  return (
    <Modal
      open
      wide
      title="과제 데이터 엑셀 올리기"
      onClose={onClose}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            닫기
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>취소</Button>
            <Button variant="primary" loading={busy} disabled={!file || !preview} onClick={() => file && send(file, false)}>
              이대로 반영
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Callout tone="ok">반영했습니다. 과제 선정 현황 · 과제 현황 · 공수 입력 · 측정 결과에 바로 보입니다.</Callout>
          <Counts s={done} />
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
          <ol className={b.small} style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              양식은{" "}
              <button className={b.lnk} onClick={() => download("/api/master/export", "생산성 측정 PoC 데이터.xlsx").catch((e) => setError({ message: errMessage(e), rows: [] }))}>
                지금 데이터로 엑셀 내려받기
              </button>
              로 받습니다. 각 팀에서 취합한 과제 선정 결과를 이 양식(01. 과제 · 02. 요구사항-SDLC · 03. 공수 태그 매핑 · 04. 기준정보)에 옮겨 적습니다.
            </li>
            <li>파일을 고르면 저장하기 전에 무엇이 바뀌는지 먼저 보여 줍니다. 확인하고 &lsquo;이대로 반영&rsquo;을 누릅니다.</li>
            <li>파일에 있는 과제·요구사항·계정은 파일 값으로 고치고, 파일에 없는 것은 그대로 둡니다(삭제는 화면에서). 오류가 하나라도 있으면 아무것도 저장하지 않습니다.</li>
          </ol>
          <input type="file" accept=".xlsx" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
          {busy && !preview && <p className="muted">파일을 확인하는 중…</p>}
          {preview && (
            <Callout tone="info">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <b>반영하면 이렇게 바뀝니다 (아직 저장 전)</b>
                <Counts s={preview} />
                <Names title="새 과제" items={preview.newProjects.map((p) => `${p.prjId} ${p.prjNm}`)} />
                <Names title="새 요구사항·단계" items={preview.newTags} />
                <Names title="새 계정" items={preview.newUsers.map((u) => `${u.userNm}(${u.userId})`)} />
              </div>
            </Callout>
          )}
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
              <div className={b.xs} style={{ marginTop: 6 }}>
                엑셀을 고친 뒤 파일을 다시 고르세요.
              </div>
            </Callout>
          )}
        </div>
      )}
    </Modal>
  );
}
