"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Field, Select, TextInput } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Callout, EmptyState, Panel, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { api, download, errMessage } from "@/lib/apiClient";
import { can } from "@/lib/auth/permissions";
import { useApi } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/labels";
import { kstDate } from "@/lib/measure/csv";
import type { HistoryEntry } from "@/lib/types";
import type { MeasureData } from "../tab/MeasureTab";
import { ProjectPicker, useSelectedProject } from "../ProjectPicker";
import s from "./collect.module.css";
import { UploadResultView, type UploadResult } from "./UploadResultView";

type Tab = "usage" | "commits" | "manual" | "history" | "scripts";

function Uploader({ prjId, kind, accept, help, onDone }: { prjId: string; kind: "usage" | "otel" | "commits"; accept: string; help: React.ReactNode; onDone: () => void }) {
  const { toast, toastError } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  async function send(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("dryRun", String(dryRun));
      form.set("file", file);
      const r = await api<UploadResult>(`/api/measure/${prjId}/upload`, { form });
      if (dryRun) setPreview(r);
      else {
        toast(`반영했습니다 — 신규 ${r.inserted}, 갱신 ${r.updated}`);
        setFile(null);
        setPreview(null);
        onDone();
      }
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function choose(f: File | null) {
    setFile(f);
    setPreview(null);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className={s.help}>{help}</div>
      <label
        className={`${s.drop} ${drag ? s.dropOver : ""}`}
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          choose(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input type="file" accept={accept} onChange={(e) => choose(e.target.files?.[0] ?? null)} hidden />
        <Icon name="upload" size={22} />
        {file ? (
          <span>
            <b>{file.name}</b> <span className="subtle">({Math.ceil(file.size / 1024).toLocaleString()} KB)</span>
          </span>
        ) : (
          <span>
            파일을 끌어다 놓거나 <b style={{ color: "var(--accent)" }}>선택</b>하세요 <span className="subtle">({accept})</span>
          </span>
        )}
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <Button disabled={!file} loading={busy && !preview} onClick={() => send(true)}>
          미리보기
        </Button>
        <Button variant="primary" disabled={!preview} loading={busy && !!preview} onClick={() => send(false)}>
          반영
        </Button>
      </div>
      {preview && <UploadResultView result={preview} />}
    </div>
  );
}

function ManualUsage({ prjId, me, wbsIds, onDone }: { prjId: string; me: { userId: string }; wbsIds: string[]; onDone: () => void }) {
  const { toast, toastError } = useToast();
  const [f, setF] = useState({ workDt: kstDate(Date.now()), wbsId: wbsIds[0] ?? "", model: "", requests: "", inputTokens: "", outputTokens: "", cacheReadTokens: "", cacheWriteTokens: "" });
  const [busy, setBusy] = useState(false);
  const n = (v: string) => Number(v || 0);
  async function save() {
    setBusy(true);
    try {
      await api(`/api/measure/${prjId}/usage`, {
        body: { workDt: f.workDt, wbsId: f.wbsId || null, userId: me.userId, model: f.model, requests: n(f.requests), inputTokens: n(f.inputTokens), outputTokens: n(f.outputTokens), cacheReadTokens: n(f.cacheReadTokens), cacheWriteTokens: n(f.cacheWriteTokens) },
      });
      toast("수기 사용량을 저장했습니다.");
      onDone();
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const field = (label: string, k: keyof typeof f, type = "number") => (
    <Field label={label}>
      <TextInput type={type} min={0} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </Field>
  );
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Callout tone="info">자동 수집(OTel·로컬 로그)이 불가능할 때만 쓰세요. '수기' 출처로 표시되어 자동 수집 데이터와 구분됩니다.</Callout>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {field("일자", "workDt", "date")}
        <Field label="WBS-ID">
          <Select value={f.wbsId} onChange={(e) => setF({ ...f, wbsId: e.target.value })}>
            {wbsIds.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
            <option value="">(미상)</option>
          </Select>
        </Field>
        <Field label="모델">
          <TextInput value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="claude-sonnet-4-5" />
        </Field>
        {field("요청 수", "requests")}
        {field("입력 토큰", "inputTokens")}
        {field("출력 토큰", "outputTokens")}
        {field("캐시 읽기 토큰", "cacheReadTokens")}
        {field("캐시 쓰기 토큰", "cacheWriteTokens")}
      </div>
      <div>
        <Button variant="primary" loading={busy} disabled={!f.model.trim()} onClick={save}>
          저장
        </Button>
      </div>
    </div>
  );
}

function Copy({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <div className={s.code}>
      <code>{text}</code>
      <button onClick={() => navigator.clipboard?.writeText(text).then(() => toast("복사했습니다."))} aria-label="복사">
        <Icon name="copy" size={14} />
      </button>
    </div>
  );
}

function Scripts() {
  const { toastError } = useToast();
  const get = (name: string) => download(`/api/scripts/${name}`, name).catch((e) => toastError(errMessage(e)));
  return (
    <div className={s.scripts}>
      <section>
        <h3>AI 사용량 — collect_ai_usage.py</h3>
        <p className="muted">개발자 PC 의 Claude Code·Codex 로컬 로그를 일자 × WBS-ID × 모델 단위 CSV 로 만듭니다. Python 3.8+ 표준 라이브러리만 사용합니다.</p>
        <Button icon="download" onClick={() => get("collect_ai_usage.py")}>
          스크립트 내려받기
        </Button>
        <span className="eyebrow">Windows</span>
        <Copy text="py collect_ai_usage.py --since 2026-10-01 --user <포털 ID>" />
        <span className="eyebrow">macOS / Linux</span>
        <Copy text="python3 collect_ai_usage.py --since 2026-10-01 --user <포털 ID>" />
        <Callout tone="warn">로컬 로그는 기본 30일 후 삭제되므로 주 1회 이상 제출해 주세요.</Callout>
      </section>
      <section>
        <h3>커밋 — extract_commits.py</h3>
        <p className="muted">clone 한 저장소의 git log 를 CSV 로 바꿉니다. Bitbucket API 권한이 필요 없습니다.</p>
        <Button icon="download" onClick={() => get("extract_commits.py")}>
          스크립트 내려받기
        </Button>
        <Copy text="py extract_commits.py --repo C:\work\<저장소> --since 2026-10-01" />
        <span className="eyebrow">스크립트 없이</span>
        <Copy text={'git log --date=short --numstat --pretty="@%h|%ad|%an|%s" > commits.txt'} />
        <Callout tone="info">
          커밋 메시지 규칙 <code>[WBS-ID] 내용</code> (예: <code>[WBS-3.2.1] 설비 이력 조회 화면 추가</code>), 작업 브랜치명에도 WBS-ID 를 넣어 주세요.
        </Callout>
      </section>
    </div>
  );
}

export function CollectView() {
  const { me } = useAuth();
  const { projects, prjId, setPrjId } = useSelectedProject();
  const { data, reload } = useApi<MeasureData>(prjId ? `/api/measure/${prjId}` : null);
  const { data: hist, reload: reloadHist } = useApi<HistoryEntry[]>(prjId ? `/api/measure/${prjId}/uploads` : null);
  const [tab, setTab] = useState<Tab>("usage");
  const [usageKind, setUsageKind] = useState<"usage" | "otel">("usage");

  const done = () => {
    reload();
    reloadHist();
  };
  const p = data?.project;
  const canUsage = !!me && !!p && can(me, "measure.upload.usage", { project: p });
  const canCommit = !!me && !!p && can(me, "measure.upload.commit", { project: p });

  return (
    <>
      <PageHeader eyebrow="Data collection" title="데이터 수집" description="AI 사용량과 커밋을 파일로 올려 측정에 반영합니다. 같은 원천을 다시 올리면 덮어쓰므로 중복 집계되지 않습니다.">
        {projects && projects.length > 0 && <ProjectPicker projects={projects} value={prjId} onChange={setPrjId} />}
      </PageHeader>
      {projects && projects.length === 0 && <EmptyState icon="upload" title="측정 중인 과제가 없습니다" />}
      {prjId && !data && <Skeleton h={300} />}
      {data && me && (
        <Panel flush>
          <div style={{ padding: "0 16px" }}>
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { key: "usage", label: "AI 사용량" },
                { key: "commits", label: "커밋" },
                { key: "manual", label: "수기 입력" },
                { key: "scripts", label: "스크립트·사용법" },
                { key: "history", label: "업로드 이력", count: hist?.length },
              ]}
            />
          </div>
          <div style={{ padding: 24 }}>
            {tab === "usage" &&
              (canUsage ? (
                <div style={{ display: "grid", gap: 16 }}>
                  <Callout tone="warn">로컬 로그는 기본 30일 후 삭제되므로 주 1회 이상 제출해 주세요.</Callout>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button variant={usageKind === "usage" ? "primary" : "secondary"} size="sm" onClick={() => setUsageKind("usage")}>
                      로컬 로그 CSV (수집 스크립트)
                    </Button>
                    <Button variant={usageKind === "otel" ? "primary" : "secondary"} size="sm" onClick={() => setUsageKind("otel")}>
                      OTel export (JSON/CSV)
                    </Button>
                  </div>
                  <Uploader
                    key={usageKind}
                    prjId={data.project.prjId}
                    kind={usageKind}
                    accept={usageKind === "otel" ? ".json,.csv" : ".csv"}
                    help={
                      usageKind === "otel" ? (
                        <>OTel 수집기에서 내보낸 파일. <code>claude_code.token.usage</code>(4종), <code>claude_code.cost.usage</code>, <code>api_request</code> 이벤트를 읽고 브랜치 속성에서 WBS-ID 를 찾습니다.</>
                      ) : (
                        <><code>collect_ai_usage.py</code> 가 만든 CSV. 같은 일자·개발자·WBS-ID·모델은 덮어씁니다.{me.role === "DEVELOPER" && " 본인 사용량만 반영됩니다."}</>
                      )
                    }
                    onDone={done}
                  />
                </div>
              ) : (
                <Callout tone="info">AI 사용량은 개발자 본인이나 AX 관리자가 올립니다.</Callout>
              ))}
            {tab === "commits" &&
              (canCommit ? (
                <Uploader
                  prjId={data.project.prjId}
                  kind="commits"
                  accept=".csv,.txt,.log"
                  help={<><code>extract_commits.py</code> 결과 CSV 나 git log 원문. 메시지의 <code>[WBS-ID]</code> 로 기능에 연결하고, 없으면 규칙 위반으로 집계합니다.</>}
                  onDone={done}
                />
              ) : (
                <Callout tone="info">커밋은 과제 PM 이나 AX 관리자가 올립니다.</Callout>
              ))}
            {tab === "manual" && (canUsage ? <ManualUsage prjId={data.project.prjId} me={me} wbsIds={data.input.features.map((f) => f.wbsId)} onDone={done} /> : <Callout tone="info">수기 입력 권한이 없습니다.</Callout>)}
            {tab === "scripts" && <Scripts />}
            {tab === "history" &&
              (hist?.length ? (
                <table className={s.hist}>
                  <tbody>
                    {hist.map((h) => (
                      <tr key={h.histId}>
                        <td className="num subtle">{fmtDateTime(h.regAt)}</td>
                        <td>{h.userNm}</td>
                        <td>{h.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState icon="history" title="업로드 이력이 없습니다" />
              ))}
          </div>
        </Panel>
      )}
    </>
  );
}
