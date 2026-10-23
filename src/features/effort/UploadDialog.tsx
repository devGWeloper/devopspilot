"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Callout } from "@/components/ui/Panel";
import { api, errMessage } from "@/lib/apiClient";
import { f1 } from "@/lib/format";
import { fmtDay } from "@/lib/labels";
import { KST_OFFSET_MS, parseCodexSessions, type SessionSummary } from "@/lib/measure/ingest";
import b from "../common/board.module.css";
import { useMutate } from "../common/useMutate";

interface Parsed {
  files: number;
  skipped: number;
  summary: SessionSummary;
  warnings: string[];
}

const ROLLOUT = /^rollout-.*\.jsonl$/i;
// React 타입에 없는 속성 — 폴더째 고르기
const FOLDER = { webkitdirectory: "", directory: "" } as Record<string, string>;

/**
 * Codex 세션 파일(~/.codex/sessions)을 브라우저에서 읽어 세션별 시간·토큰·태그 후보만 보낸다.
 * 대화 원문이 PC 밖으로 나가지 않게 하려고 서버가 아니라 여기서 파싱한다.
 */
export function UploadDialog({ since, onClose }: { since: string; onClose: () => void }) {
  const { run, busy } = useMutate();
  const [reading, setReading] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [result, setResult] = useState<{ sessions: number; warnings: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pick(list: FileList | null, folder: boolean) {
    setErr(null);
    setParsed(null);
    const all = Array.from(list ?? []).filter((f) => (folder ? ROLLOUT.test(f.name) : /\.jsonl$/i.test(f.name)));
    if (all.length === 0) {
      setErr(folder ? "이 폴더에 Codex 세션 파일(rollout-*.jsonl)이 없습니다. ~/.codex/sessions 폴더를 골라 주세요." : ".jsonl 세션 파일을 골라 주세요.");
      return;
    }
    // 측정 시작일 전에 마지막으로 쓰인 파일은 시작일 이후 기록이 있을 수 없어 읽지 않는다.
    const from = since ? Date.parse(`${since}T00:00:00Z`) - KST_OFFSET_MS : 0;
    const files = all.filter((f) => f.lastModified >= from);
    setReading(true);
    try {
      const texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
      const { summary, warnings } = parseCodexSessions(texts, since);
      setParsed({ files: files.length, skipped: all.length - files.length, summary, warnings });
    } catch (e) {
      setErr(`파일을 읽지 못했습니다: ${errMessage(e)}`);
    } finally {
      setReading(false);
    }
  }

  async function upload() {
    if (!parsed) return;
    await run(async () => {
      setResult(await api("/api/effort/upload", { method: "POST", body: parsed.summary }));
    });
  }

  const ss = parsed?.summary.sessions ?? [];
  const dates = Array.from(new Set(ss.map((x) => x.date))).sort();
  const hours = ss.reduce((a, x) => a + x.activeMin, 0) / 60;

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
            <Button variant="primary" loading={busy} disabled={!ss.length || reading} onClick={upload}>
              {ss.length ? `세션 ${ss.length}건 올리기` : "올리기"}
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
            PC 의 Codex 세션 파일을 고르면 이 화면이 읽어 <b>세션별 사용 시간·토큰과 공수 태그 후보</b>만 올립니다. 대화 원문은 서버로 가지 않습니다.
          </p>
          <ol className={b.small} style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              위치: <code>%USERPROFILE%\.codex\sessions</code> (macOS·Linux <code>~/.codex/sessions</code>) 아래 날짜 폴더의 <code>rollout-*.jsonl</code>
            </li>
            <li>숨김 폴더라 안 보이면 파일 창 주소줄에 위 경로를 붙여 넣습니다.</li>
            <li>폴더째 고르면 측정 시작일({fmtDay(since)}) 이후 기록만 올라갑니다. 같은 세션을 다시 올려도 중복되지 않고, 이미 배정한 결과는 유지됩니다.</li>
          </ol>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className={b.lnk} style={{ cursor: "pointer" }}>
              세션 파일 고르기
              <input type="file" multiple accept=".jsonl" hidden onChange={(e) => pick(e.target.files, false)} />
            </label>
            <span className="subtle">또는</span>
            <label className={b.lnk} style={{ cursor: "pointer" }}>
              sessions 폴더째 고르기
              <input type="file" hidden {...FOLDER} onChange={(e) => pick(e.target.files, true)} />
            </label>
          </div>
          {reading && <p className="muted">파일을 읽는 중…</p>}
          {parsed && (
            <Callout tone={ss.length ? "info" : "warn"}>
              {ss.length ? (
                <>
                  파일 {parsed.files}개 → 세션 {ss.length}건 · {fmtDay(dates[0])}
                  {dates.length > 1 && ` ~ ${fmtDay(dates[dates.length - 1])}`} · 활동 {f1(hours)}h
                </>
              ) : (
                <>올릴 세션이 없습니다 — 측정 시작일 이후 Codex 사용 기록이 없는 파일입니다.</>
              )}
              {parsed.skipped > 0 && <div className={b.xs}>측정 시작일 전 파일 {parsed.skipped}개는 읽지 않았습니다.</div>}
              {parsed.warnings.length > 0 && <div className={b.xs}>경고 {parsed.warnings.length}건: {parsed.warnings.slice(0, 3).join(" / ")}</div>}
            </Callout>
          )}
          {err && <Callout tone="danger">{err}</Callout>}
        </div>
      )}
    </Modal>
  );
}
