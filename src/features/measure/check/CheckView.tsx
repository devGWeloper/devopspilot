"use client";

import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { Callout, EmptyState, KpiTile, Panel, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { pct } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { CheckReport } from "@/lib/measure/crosscheck";
import s from "../tab/tab.module.css";

interface Summary {
  projects: { prjId: string; prjNm: string }[];
  settings: { postFixDays: number };
  check: CheckReport;
}

const KIND: Record<string, { label: string; tone: "danger" | "warn" | "info" }> = {
  COMMIT_OUTSIDE: { label: "커밋 날짜 불일치", tone: "warn" },
  AI_OUTSIDE: { label: "AI 사용일 불일치", tone: "warn" },
  NO_TRACE: { label: "커밋·AI 기록 없음", tone: "danger" },
};

export function CheckView() {
  const { data, error } = useApi<Summary>("/api/measure/summary");
  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!data) return <Skeleton h={400} />;
  const c = data.check;
  const nm = (prjId: string) => data.projects.find((p) => p.prjId === prjId)?.prjNm ?? prjId;

  return (
    <>
      <PageHeader eyebrow="Data quality" title="데이터 점검" description="측정 결과를 믿을 수 있는지 확인합니다. 공수 기록과 커밋·AI 로그의 날짜가 맞는지, 입력이 빠진 기능은 없는지 봅니다." />
      <section className={s.kpis} style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))", marginBottom: 16 }}>
        <KpiTile label="교차 검증 불일치" value={c.cross.length} unit="건" />
        <KpiTile label="미입력 기능" value={c.idle.length} unit="건" sub="진행 중 · 최근 기록 없음" />
        <KpiTile label="커밋 규칙 위반" value={pct(c.commitViolation.rate)} sub={`${c.commitViolation.violations} / ${c.commitViolation.total} 커밋`} />
        <KpiTile label="WBS 미상 AI 사용량" value={c.unknownWbsUsage} unit="행" sub={c.unpricedModels.length ? `단가 미설정 모델 ${c.unpricedModels.length}개` : "단가 모두 설정됨"} />
      </section>
      <div style={{ display: "grid", gap: 16 }}>
        <Panel eyebrow="Cross check" title="교차 검증 — 공수 기록 기간 vs 커밋·AI 로그" flush>
          {c.cross.length === 0 ? (
            <EmptyState icon="check" title="불일치가 없습니다" />
          ) : (
            <table className={s.mini}>
              <thead>
                <tr>
                  <th>과제</th>
                  <th>기능</th>
                  <th>유형</th>
                  <th>기준</th>
                  <th>어긋난 날짜</th>
                </tr>
              </thead>
              <tbody>
                {c.cross.map((x, i) => (
                  <tr key={i}>
                    <td>
                      <Link href={`/projects/${x.prjId}?tab=measure`} style={{ color: "var(--accent)", fontWeight: 600 }}>
                        {nm(x.prjId)}
                      </Link>
                    </td>
                    <td>
                      {x.wbsId} <span className="subtle">{x.featureName}</span>
                    </td>
                    <td>
                      <Chip tone={KIND[x.kind].tone}>{KIND[x.kind].label}</Chip>
                    </td>
                    <td className="subtle">{x.detail}</td>
                    <td className="num">{x.dates.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel eyebrow="Missing input" title="미입력 — 진행 중인데 공수 기록이 멈춘 기능" flush>
          {c.idle.length === 0 ? (
            <EmptyState icon="check" title="미입력 기능이 없습니다" />
          ) : (
            <table className={s.mini}>
              <thead>
                <tr>
                  <th>과제</th>
                  <th>기능</th>
                  <th>담당</th>
                  <th>마지막 기록</th>
                  <th className={s.r}>경과</th>
                </tr>
              </thead>
              <tbody>
                {c.idle.map((x) => (
                  <tr key={`${x.prjId}${x.wbsId}`}>
                    <td>{nm(x.prjId)}</td>
                    <td>
                      {x.wbsId} <span className="subtle">{x.featureName}</span>
                    </td>
                    <td>{x.devUserNm ?? "미지정"}</td>
                    <td className="num">{x.lastWorkDt ?? "기록 없음"}</td>
                    <td className={`${s.r} num`}>{x.idleDays === null ? "—" : `${x.idleDays}일`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        {c.unpricedModels.length > 0 && <Callout tone="warn">단가가 없는 모델: {c.unpricedModels.join(", ")} — 측정 설정에서 입력해야 AI 비용에 반영됩니다.</Callout>}
      </div>
    </>
  );
}
