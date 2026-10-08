"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { Callout, KpiTile, Panel, Skeleton } from "@/components/ui/Panel";
import { hours, pct, won } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { CheckReport } from "@/lib/measure/crosscheck";
import type { MeasureInput, MetricsResult } from "@/lib/measure/types";
import type { Project } from "@/lib/types";
import { ReviewTab } from "../../project-detail/ReviewTab";
import { CommitSummary } from "./CommitSummary";
import { DefectList } from "./DefectList";
import { EffortGrid } from "./EffortGrid";
import s from "./tab.module.css";
import { UsagePanel } from "./UsagePanel";

export interface MeasureData {
  project: Project;
  input: MeasureInput;
  metrics: MetricsResult;
  check: CheckReport;
}

export function MeasureTab({ project, onProjectChange }: { project: Project; onProjectChange: (p: Project) => void }) {
  const { me } = useAuth();
  const { data, error, reload } = useApi<MeasureData>(`/api/measure/${project.prjId}`);

  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!data || !me) return <Skeleton h={420} />;
  const m = data.metrics.overall;
  const ref = m.reference ? " · 참고값" : "";

  return (
    <div className={s.wrap}>
      <section className={s.kpis}>
        <KpiTile label="공수 절감률" value={pct(m.savingRate)} sub={`완료 ${m.doneCount}/${m.featureCount} 기능 · 공수 가중${ref}`} />
        <KpiTile label="기능당 투입시간" value={hours(m.hoursPerFeature)} sub={`기존 ${hours(m.doneCount ? m.sumA / m.doneCount : null)}`} />
        <KpiTile label="AI 비용" value={won(m.aiCost)} sub={`요청 ${m.aiRequests.toLocaleString()}건`} />
        <KpiTile label="결함률 A → B" value={`${m.defectRateA?.toFixed(2) ?? "—"} → ${m.defectRateB?.toFixed(2) ?? "—"}`} sub="기능당 결함 수, 같은 테스트케이스 기준" />
        <KpiTile label="사후 수정률" value={pct(m.postFixRate, 1)} sub={`${m.postFixLines.toLocaleString()} / ${m.totalLines.toLocaleString()} 라인`} />
      </section>

      <Panel
        eyebrow="Effort ledger"
        title="공수 기록표"
        actions={
          <span className={s.legend}>
            <span className={s.lgPl} /> PL 사전 기입
            <span className={s.lgDev} /> 개발자 기입
            <span className={s.lgAuto} /> 자동 계산
          </span>
        }
        flush
      >
        <EffortGrid data={data} me={me} onChanged={reload} />
      </Panel>

      <div className={s.grid2}>
        <Panel eyebrow="Defects" title={`결함 (Replay 테스트) ${data.input.defects.length}건`} flush>
          <DefectList data={data} me={me} onChanged={reload} />
        </Panel>
        <Panel eyebrow="Commits" title="커밋 요약" flush>
          <CommitSummary data={data} />
        </Panel>
      </div>

      <Panel eyebrow="AI usage" title="AI 사용량">
        <UsagePanel data={data} />
      </Panel>

      <div>
        <h3 className="h2" style={{ marginBottom: 12 }}>측정 코멘트</h3>
        <ReviewTab p={data.project} me={me} context="MEASURE" onChange={(p) => onProjectChange(p)} />
      </div>
    </div>
  );
}
