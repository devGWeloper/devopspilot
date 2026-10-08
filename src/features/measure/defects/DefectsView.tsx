"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Callout, EmptyState, Panel, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api, errMessage } from "@/lib/apiClient";
import { can } from "@/lib/auth/permissions";
import { useApi } from "@/lib/hooks";
import { PHASE_LABEL, type Defect } from "@/lib/measure/types";
import { DefectForm } from "../tab/DefectList";
import type { MeasureData } from "../tab/MeasureTab";
import { ProjectPicker, useSelectedProject } from "../ProjectPicker";
import { JiraImport } from "./JiraImport";

export function DefectsView() {
  const { me } = useAuth();
  const { toast, toastError } = useToast();
  const { projects, prjId, setPrjId } = useSelectedProject();
  const { data, error, reload } = useApi<MeasureData>(prjId ? `/api/measure/${prjId}` : null);
  const [mode, setMode] = useState<"add" | "jira" | null>(null);

  const canEdit = !!me && !!data && can(me, "measure.defect", { project: data.project });

  async function remove(d: Defect) {
    try {
      await api(`/api/measure/${d.prjId}/defects?defectId=${encodeURIComponent(d.defectId)}`, { method: "DELETE" });
      toast(`${d.defectId} 삭제`);
      reload();
    } catch (e) {
      toastError(errMessage(e));
    }
  }

  const columns: Column<Defect>[] = [
    { key: "id", header: "결함 ID", width: 100, render: (d) => <b className="num">{d.defectId}</b>, sortValue: (d) => d.defectId },
    { key: "wbs", header: "기능", width: 220, render: (d) => <span>{d.wbsId} <span className="subtle">{data?.input.features.find((f) => f.wbsId === d.wbsId)?.name}</span></span>, sortValue: (d) => d.wbsId },
    { key: "title", header: "제목", render: (d) => d.title },
    { key: "sev", header: "심각도", width: 80, render: (d) => (d.severity === "CRITICAL" ? <Chip tone="danger">치명</Chip> : <Chip>일반</Chip>), sortValue: (d) => d.severity },
    { key: "phase", header: "발견 단계", width: 100, render: (d) => PHASE_LABEL[d.phase] },
    { key: "tc", header: "테스트케이스", width: 110, render: (d) => d.testCaseRef || "—" },
    { key: "dt", header: "발견일", width: 110, render: (d) => <span className="num">{d.foundDt}</span>, sortValue: (d) => d.foundDt },
    { key: "src", header: "출처", width: 70, render: (d) => <Chip tone={d.srcCd === "JIRA" ? "info" : "outline"}>{d.srcCd === "JIRA" ? "Jira" : "수기"}</Chip> },
    ...(canEdit
      ? [{ key: "del", header: "", width: 60, render: (d: Defect) => <Button size="sm" variant="ghost" icon="trash" onClick={() => remove(d)} aria-label={`${d.defectId} 삭제`} /> }]
      : []),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Defects"
        title="결함 관리"
        description="Replay 테스트(B)에서 발견한 결함입니다. 당시 테스트케이스 기준으로 발견된 결함만 등록해야 기존 실적(A)과 비교할 수 있습니다."
        actions={
          canEdit && (
            <>
              <Button icon="upload" onClick={() => setMode("jira")}>
                Jira CSV 가져오기
              </Button>
              <Button variant="primary" icon="plus" onClick={() => setMode("add")}>
                결함 등록
              </Button>
            </>
          )
        }
      >
        {projects && projects.length > 0 && <ProjectPicker projects={projects} value={prjId} onChange={setPrjId} />}
      </PageHeader>
      {projects && projects.length === 0 && <EmptyState icon="bug" title="측정 중인 과제가 없습니다">선정된 과제가 있어야 결함을 등록할 수 있습니다.</EmptyState>}
      {error && <Callout tone="danger">{error}</Callout>}
      {prjId && !data && <Skeleton h={300} />}
      {data && mode === "jira" && <JiraImport data={data} onDone={() => (setMode(null), reload())} onCancel={() => setMode(null)} />}
      {data && (
        <Panel flush>
          <DataTable columns={columns} rows={data.input.defects} rowKey={(d) => d.defectId} initialSort={{ key: "dt", dir: "desc" }} empty={<EmptyState icon="bug" title="등록된 결함이 없습니다" />} />
        </Panel>
      )}
      {data && mode === "add" && (
        <DefectForm prjId={data.project.prjId} wbsIds={data.input.features.map((f) => ({ wbsId: f.wbsId, name: f.name }))} onClose={() => setMode(null)} onSaved={() => (setMode(null), reload())} />
      )}
    </>
  );
}
