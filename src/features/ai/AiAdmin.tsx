"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FitBadge, FitPair } from "@/components/ui/FitBadge";
import { Callout, Panel, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { useApi } from "@/lib/hooks";
import { fmtDateTime, STATUS_LABEL } from "@/lib/labels";
import type { Project } from "@/lib/types";
import s from "./ai.module.css";

interface PromptData {
  prompt: { text: string; version: number; updatedBy: string | null; updatedAt: string | null };
  model: string;
  baseUrlSet: boolean;
}

export function AiAdmin() {
  const { toast, toastError } = useToast();
  const { data, error, reload } = useApi<PromptData>("/api/ai/prompt");
  const { data: projects, setData: setProjects } = useApi<Project[]>("/api/projects");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number; errors: { prjId: string; message: string }[] } | null>(null);

  useEffect(() => {
    if (data) setText(data.prompt.text);
  }, [data]);

  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!data) return <Skeleton h={400} />;

  async function save() {
    setBusy("save");
    try {
      await api("/api/ai/prompt", { method: "PUT", body: { text } });
      toast("프롬프트를 저장했습니다.");
      reload();
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function testConn() {
    setBusy("ping");
    try {
      const r = await api<{ model: string; ms: number }>("/api/ai/ping", { method: "POST" });
      toast(`연결 성공 — ${r.model}, ${r.ms}ms`);
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function run() {
    const ids = Array.from(picked);
    const errors: { prjId: string; message: string }[] = [];
    setProgress({ done: 0, total: ids.length, errors });
    // 사내 엔드포인트 부하·속도 제한을 고려해 한 건씩 순서대로 보낸다.
    for (let i = 0; i < ids.length; i++) {
      try {
        const p = await api<Project>("/api/ai/assess", { body: { prjId: ids[i] } });
        setProjects((xs) => (xs ?? []).map((x) => (x.prjId === p.prjId ? p : x)));
      } catch (e) {
        errors.push({ prjId: ids[i], message: errMessage(e) });
      }
      setProgress({ done: i + 1, total: ids.length, errors: [...errors] });
    }
    toast(`AI 판정 완료 — 성공 ${ids.length - errors.length}, 실패 ${errors.length}`);
  }

  const dirty = text !== data.prompt.text;
  const list = (projects ?? []).filter((p) => p.status !== "EXCLUDED");
  const running = !!progress && progress.done < progress.total;

  return (
    <>
      <PageHeader
        eyebrow="AI assessment · 보조 기능"
        title="AI 적합도 의견"
        description="컨설턴트가 작성한 판정 기준 프롬프트로 사내 LLM 에게 과제별 적합도 의견을 받습니다. 결과는 참고용이며 확정 적합도에 자동 반영되지 않습니다."
      />
      <div style={{ marginBottom: 16 }}>
        <Callout tone="info">
          판정을 실행하면 과제 정보(기본정보·지표 응답·선정 분포)가 사내 LLM 엔드포인트로 전송됩니다. 모델 <b>{data.model || "미설정"}</b>
          {!data.baseUrlSet && " · baseUrl 미설정"}
        </Callout>
      </div>
      <div className={s.layout}>
        <Panel
          eyebrow={`Consultant prompt · v${data.prompt.version}`}
          title="판정 기준 프롬프트"
          actions={
            <>
              <Button size="sm" loading={busy === "ping"} onClick={testConn}>
                연결 테스트
              </Button>
              <Button size="sm" variant="primary" loading={busy === "save"} disabled={!dirty} onClick={save}>
                저장
              </Button>
            </>
          }
        >
          <textarea className={s.editor} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="컨설턴트 프롬프트" />
          <p className="subtle" style={{ fontSize: 12, marginTop: 8 }}>
            {data.prompt.updatedAt ? `마지막 저장 ${fmtDateTime(data.prompt.updatedAt)} · ${data.prompt.updatedBy}` : "아직 저장되지 않은 기본 틀입니다. 각 섹션을 채워 저장해야 판정을 실행할 수 있습니다."} 출력 형식(JSON)은 앱이 자동으로 붙입니다.
          </p>
        </Panel>
        <Panel
          eyebrow="Run"
          title="판정 실행"
          actions={
            <Button size="sm" variant="primary" icon="spark" disabled={!picked.size || running || data.prompt.version === 0 || dirty} loading={running} onClick={run}>
              {picked.size}건 판정
            </Button>
          }
          flush
        >
          {progress && (
            <div className={s.progress}>
              <div className={s.bar}>
                <span style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
              </div>
              <span className="num">
                {progress.done}/{progress.total}
              </span>
              {progress.errors.map((e) => (
                <div key={e.prjId} className={s.err}>
                  {e.prjId}: {e.message}
                </div>
              ))}
            </div>
          )}
          <table className={s.table}>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label="전체 선택" checked={list.length > 0 && picked.size === list.length} onChange={(e) => setPicked(new Set(e.target.checked ? list.map((p) => p.prjId) : []))} />
                </th>
                <th>과제</th>
                <th>상태</th>
                <th>적합도</th>
                <th>AI 의견</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const differs = p.aiFit && p.aiFit !== (p.finalFit !== "NA" ? p.finalFit : p.suggestFit);
                return (
                  <tr key={p.prjId} className={differs ? s.differs : ""}>
                    <td>
                      <input type="checkbox" aria-label={`${p.prjId} 선택`} checked={picked.has(p.prjId)} onChange={(e) => setPicked((x) => new Set(e.target.checked ? [...x, p.prjId] : [...x].filter((y) => y !== p.prjId)))} />
                    </td>
                    <td>
                      <Link href={`/projects/${p.prjId}?tab=ai`} className={s.plink}>
                        {p.prjNm}
                      </Link>
                    </td>
                    <td className="subtle">{STATUS_LABEL[p.status]}</td>
                    <td>
                      <FitPair finalFit={p.finalFit} suggestFit={p.suggestFit} size="sm" />
                    </td>
                    <td>{p.aiFit ? <FitBadge fit={p.aiFit} size="sm" /> : <span className="subtle">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="subtle" style={{ fontSize: 12, padding: "10px 16px" }}>
            노란 행은 AI 의견이 현재 적합도와 다른 과제입니다.
          </p>
        </Panel>
      </div>
    </>
  );
}
