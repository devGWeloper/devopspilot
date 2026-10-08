"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Select } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { jiraHeaders } from "@/lib/measure/parsers/jiraCsv";
import type { JiraMapping } from "@/lib/measure/types";
import { UploadResultView, type UploadResult } from "../collect/UploadResultView";
import type { MeasureData } from "../tab/MeasureTab";

const guess = (hs: string[], ...names: string[]) => hs.find((h) => names.some((n) => h.toLowerCase() === n.toLowerCase())) ?? hs.find((h) => names.some((n) => h.toLowerCase().includes(n.toLowerCase()))) ?? "";

export function JiraImport({ data, onDone, onCancel }: { data: MeasureData; onDone: () => void; onCancel: () => void }) {
  const { toast, toastError } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState<JiraMapping | null>(null);
  const [preview, setPreview] = useState<UploadResult | null>(null);
  const [busy, setBusy] = useState(false);
  const saved = data.input.settings.jiraMappings[data.project.prjId];

  async function pick(f: File | null) {
    setFile(f);
    setPreview(null);
    if (!f) return;
    const hs = jiraHeaders(await f.text());
    setHeaders(hs);
    setMap(
      saved && hs.includes(saved.idCol)
        ? saved
        : {
            idCol: guess(hs, "Issue key", "key", "이슈 키"),
            createdCol: guess(hs, "Created", "생성일"),
            summaryCol: guess(hs, "Summary", "요약"),
            wbsCol: guess(hs, "WBS") || null,
            priorityCol: guess(hs, "Priority", "우선순위") || null,
            priorityMap: { Highest: "CRITICAL", High: "CRITICAL", Blocker: "CRITICAL", Critical: "CRITICAL" },
            phaseCol: null,
            causeCol: null,
          },
    );
  }

  async function run(dryRun: boolean) {
    if (!file || !map) return;
    setBusy(true);
    try {
      await api(`/api/measure/${data.project.prjId}/jira-mapping`, { method: "PUT", body: map });
      const form = new FormData();
      form.set("kind", "jira");
      form.set("dryRun", String(dryRun));
      form.set("file", file);
      const r = await api<UploadResult>(`/api/measure/${data.project.prjId}/upload`, { form });
      if (dryRun) setPreview(r);
      else {
        toast(`Jira 결함 반영: 신규 ${r.inserted}, 갱신 ${r.updated}`);
        onDone();
      }
    } catch (e) {
      toastError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const col = (label: string, key: keyof JiraMapping, required = false) => (
    <Field label={label} required={required}>
      <Select value={(map?.[key] as string) ?? ""} onChange={(e) => setMap((m) => (m ? { ...m, [key]: e.target.value || null } : m))}>
        <option value="">{required ? "선택" : "사용 안 함"}</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <Panel eyebrow="Jira import" title="Jira CSV 가져오기" style={{ marginBottom: 16 }} actions={<Button variant="ghost" icon="x" onClick={onCancel}>닫기</Button>}>
      <div style={{ display: "grid", gap: 16 }}>
        <input type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        {map && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {col("결함 ID 열", "idCol", true)}
              {col("생성일 열", "createdCol", true)}
              {col("요약 열", "summaryCol", true)}
              {col("WBS-ID 열", "wbsCol")}
              {col("우선순위 열", "priorityCol")}
              {col("발견 단계 열", "phaseCol")}
              {col("원인 열", "causeCol")}
              <Field label="'치명'으로 볼 우선순위" hint="쉼표로 구분">
                <input
                  className="__jira"
                  style={{ height: 38, border: "1px solid var(--line-strong)", borderRadius: 6, padding: "0 10px" }}
                  value={Object.keys(map.priorityMap).join(", ")}
                  onChange={(e) => setMap({ ...map, priorityMap: Object.fromEntries(e.target.value.split(",").map((x) => x.trim()).filter(Boolean).map((x) => [x, "CRITICAL" as const])) })}
                />
              </Field>
            </div>
            <p className="muted" style={{ fontSize: 12.5 }}>
              WBS-ID 열이 비어 있으면 요약에서 WBS-ID 를 찾습니다. 같은 결함 ID 를 다시 올리면 덮어씁니다. 매핑은 이 과제에 저장됩니다.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button loading={busy && !preview} onClick={() => run(true)}>
                미리보기
              </Button>
              <Button variant="primary" loading={busy && !!preview} disabled={!preview} onClick={() => run(false)}>
                반영
              </Button>
            </div>
          </>
        )}
        {preview && <UploadResultView result={preview} />}
      </div>
    </Panel>
  );
}
