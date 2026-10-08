"use client";

import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { FitBadge } from "@/components/ui/FitBadge";
import { Icon } from "@/components/ui/Icon";
import { Callout, EmptyState, Panel, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { download, errMessage } from "@/lib/apiClient";
import { can } from "@/lib/auth/permissions";
import { CAVEATS } from "@/lib/measure/caveats";
import { hours, pct, won } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { FIT_COLOR, FIT_LABEL } from "@/lib/labels";
import type { CheckReport } from "@/lib/measure/crosscheck";
import { PHASE_LABEL, PHASES, type MetricSet, type MetricsResult, type Phase, type Size } from "@/lib/measure/types";
import type { Fit } from "@/lib/types";
import s from "./measure.module.css";

interface Summary {
  projects: { prjId: string; prjNm: string; finalFit: Fit; suggestFit: Fit }[];
  settings: { featureTypes: { code: string; label: string }[]; phases: Record<Phase, boolean>; sampleValues: boolean; laborRatePerHour: number; postFixDays: number };
  metrics: MetricsResult;
  evidence: { verified: number; total: number };
  check: CheckReport;
}

function Kpi({ label, value, desc, reference }: { label: string; value: string; desc: string; reference?: boolean }) {
  return (
    <div className={s.kpi}>
      <span className={s.kpiLabel}>
        {label}
        {reference && <span className={s.refTag}>참고값</span>}
      </span>
      <span className={s.kpiValue}>{value}</span>
      <span className={s.kpiDesc}>{desc}</span>
    </div>
  );
}

const SIZES: Size[] = ["S", "M", "L"];
const FIT_X: Record<Fit, number> = { H: 1, M: 2, L: 3, NA: 4 };

export function MeasureDashboard() {
  const { me } = useAuth();
  const { toastError } = useToast();
  const [prj, setPrj] = useState("");
  const [type, setType] = useState("");
  const { data, error } = useApi<Summary>(`/api/measure/summary${prj ? `?prjId=${prj}` : ""}`);

  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!data) return <Skeleton h={500} />;

  const mx = data.metrics;
  const m: MetricSet = type ? mx.byType[type] ?? mx.overall : mx.overall;
  const types = Object.fromEntries(data.settings.featureTypes.map((t) => [t.code, t.label]));
  const fms = mx.byFeature.filter((f) => !type || f.feature.typeCd === type);
  const phases = PHASES.filter((p) => data.settings.phases[p]);
  const featureBars = fms.map((f) => ({
    name: f.feature.wbsId,
    label: f.feature.name,
    A: f.a,
    ...Object.fromEntries(phases.map((p) => [PHASE_LABEL[p], f.bByPhase[p]])),
  }));
  const phaseBars = phases.map((p) => ({ phase: PHASE_LABEL[p], rate: m.phaseSaving[p] === null ? 0 : Math.round((m.phaseSaving[p] ?? 0) * 1000) / 10 }));
  const scatter = data.projects
    .map((p) => {
      const ms = mx.byProject[p.prjId];
      const fit = p.finalFit !== "NA" ? p.finalFit : p.suggestFit;
      if (!ms || ms.savingRate === null) return null;
      return { x: FIT_X[fit] + (p.prjId.charCodeAt(p.prjId.length - 1) % 5) * 0.06 - 0.12, y: Math.round(ms.savingRate * 1000) / 10, z: Math.max(1, ms.doneCount), name: p.prjNm, fit };
    })
    .filter(Boolean) as { x: number; y: number; z: number; name: string; fit: Fit }[];
  const B_COLORS = ["#2b3a8c", "#5466d6", "#8c9cf0", "#c5cbea"];

  return (
    <>
      <PageHeader
        eyebrow="Productivity measurement"
        title="생산성 측정 대시보드"
        description="Replay 테스트(B)를 기존 실적(A)과 비교한 결과입니다. 모든 수치는 완료된 기능 기준이며, 절감률은 공수 가중 방식으로 계산합니다."
        actions={
          me &&
          can(me, "export") && (
            <Button icon="download" onClick={() => download(`/api/export/measure${prj ? `?prjId=${prj}` : ""}`, "PoC_생산성측정.xlsx").catch((e) => toastError(errMessage(e)))}>
              지표·원천 엑셀
            </Button>
          )
        }
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Select value={prj} onChange={(e) => setPrj(e.target.value)} style={{ width: 280 }} aria-label="과제">
            <option value="">전체 과제 ({data.projects.length})</option>
            {data.projects.map((p) => (
              <option key={p.prjId} value={p.prjId}>
                {p.prjId} · {p.prjNm}
              </option>
            ))}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} style={{ width: 200 }} aria-label="유형">
            <option value="">전체 유형</option>
            {data.settings.featureTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
      </PageHeader>

      <aside className={s.caveats} aria-label="해석 주의사항">
        <div className={s.caveatHead}>
          <Icon name="alert" size={16} /> 해석 주의사항
        </div>
        <ol>
          <li>{CAVEATS[0]}</li>
          <li>
            {CAVEATS[1]} <b>근거 확인 {data.evidence.verified}/{data.evidence.total}</b>
          </li>
          <li>{CAVEATS[2]}</li>
        </ol>
      </aside>

      {mx.byFeature.length === 0 ? (
        <EmptyState icon="gauge" title="측정 데이터가 없습니다">선정 과제의 PM 이 측정 탭에서 기능과 기존 실적(A)을 등록하면 지표가 계산됩니다.</EmptyState>
      ) : (
        <>
          {data.settings.sampleValues && (
            <div style={{ marginBottom: 12 }}>
              <Callout tone="warn">인건비·토큰 단가가 예시값입니다. 측정 설정에서 확정하면 경제성 지표가 정확해집니다.</Callout>
            </div>
          )}
          <div className={s.kpiGroups}>
            <section className={s.group}>
              <span className="eyebrow">생산성</span>
              <div className={s.groupGrid}>
                <Kpi label="공수 절감률" value={pct(m.savingRate)} desc={`(ΣA − ΣB) ÷ ΣA · ${hours(m.sumA)} → ${hours(m.sumB)}`} reference={m.reference} />
                <Kpi label="기능당 투입시간" value={hours(m.hoursPerFeature)} desc={`Replay B · 완료 ${m.doneCount}개 기능`} reference={m.reference} />
                <Kpi label="단계별 절감률" value={phases.map((p) => pct(m.phaseSaving[p])).join(" · ")} desc={phases.map((p) => PHASE_LABEL[p]).join(" · ")} reference={m.reference} />
              </div>
            </section>
            <section className={s.group}>
              <span className="eyebrow">경제성</span>
              <div className={s.groupGrid4}>
                <Kpi label="AI 비용" value={won(m.aiCost)} desc="토큰 4종 × 사내 단가" />
                <Kpi label="AI 요청 수" value={m.aiRequests.toLocaleString()} desc="API 요청 건수" />
                <Kpi label="기능당 총비용" value={won(m.costPerFeature)} desc={`B × ${won(data.settings.laborRatePerHour)}/h + AI 비용`} reference={m.reference} />
                <Kpi label="기능당 비용 차이" value={won(m.costDiffPerFeature)} desc="기존 인건비 − Replay 총비용" reference={m.reference} />
              </div>
            </section>
            <section className={s.group}>
              <span className="eyebrow">품질</span>
              <div className={s.groupGrid}>
                <Kpi label="결함률 A → B" value={`${m.defectRateA?.toFixed(2) ?? "—"} → ${m.defectRateB?.toFixed(2) ?? "—"}`} desc="기능당 결함 · 같은 테스트케이스" reference={m.reference} />
                <Kpi label="사후 수정률" value={pct(m.postFixRate, 1)} desc={`완료 후 ${data.settings.postFixDays}일 내 같은 WBS 변경 라인`} />
              </div>
            </section>
          </div>

          <div className={s.grid2}>
            <Panel eyebrow="A vs B by feature" title="기능별 기존 실적 A vs Replay B">
              <div style={{ height: Math.max(220, featureBars.length * 46 + 60) }}>
                <ResponsiveContainer>
                  <BarChart data={featureBars} layout="vertical" margin={{ left: 8, right: 16 }} barGap={3}>
                    <CartesianGrid horizontal={false} stroke="#ece9e1" />
                    <XAxis type="number" unit="h" tick={{ fontSize: 11, fill: "#8a8f98" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 11.5, fill: "#2c3854" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e4e1d8", fontSize: 12 }} labelFormatter={(n) => `${n} ${featureBars.find((f) => f.name === n)?.label ?? ""}`} />
                    <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="A" name="기존 실적 A" fill="#d3cfc2" barSize={10} radius={[0, 3, 3, 0]} />
                    {phases.map((p, i) => (
                      <Bar key={p} dataKey={PHASE_LABEL[p]} name={`B · ${PHASE_LABEL[p]}`} stackId="b" fill={B_COLORS[i]} barSize={10} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel eyebrow="By phase" title="단계별 절감률">
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={phaseBars} margin={{ top: 16, right: 8, left: -8 }}>
                    <CartesianGrid vertical={false} stroke="#ece9e1" />
                    <XAxis dataKey="phase" tick={{ fontSize: 12, fill: "#2c3854" }} axisLine={false} tickLine={false} />
                    <YAxis unit="%" tick={{ fontSize: 11, fill: "#8a8f98" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 8, border: "1px solid #e4e1d8", fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="#8a8f98" />
                    <Bar dataKey="rate" name="절감률" fill="#1e7a5a" radius={[4, 4, 0, 0]} barSize={36} label={{ position: "top", fontSize: 12, fontWeight: 700, formatter: (v: unknown) => `${v}%` }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className={s.grid2}>
            <Panel eyebrow="Type × size" title="유형 × 규모 매트릭스">
              <table className={s.matrix}>
                <thead>
                  <tr>
                    <th />
                    {SIZES.map((sz) => (
                      <th key={sz}>
                        {sz} <span className="subtle">{sz === "S" ? "~16h" : sz === "M" ? "16~40h" : "40h~"}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.settings.featureTypes.map((t) => (
                    <tr key={t.code}>
                      <th>{t.label}</th>
                      {SIZES.map((sz) => {
                        const c = mx.byTypeSize[`${t.code}|${sz}`];
                        return (
                          <td key={sz} className={!c ? s.cellEmpty : c.reference ? s.cellRef : ""}>
                            {c ? (
                              <>
                                <b className="num">{pct(c.savingRate)}</b>
                                <span className="subtle">
                                  n={c.featureCount}
                                  {c.reference && " · 참고"}
                                </span>
                              </>
                            ) : (
                              <span className="subtle">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={s.note}>기능이 2개 미만인 칸은 참고값입니다.</p>
            </Panel>
            <Panel eyebrow="Selection check" title="선정 적합도 대비 실제 절감률">
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="#ece9e1" />
                    <XAxis type="number" dataKey="x" domain={[0.5, 3.5]} ticks={[1, 2, 3]} tickFormatter={(v: number) => ["", "상", "중", "하"][Math.round(v)] ?? ""} tick={{ fontSize: 12, fill: "#2c3854" }} axisLine={false} tickLine={false} />
                    <YAxis type="number" dataKey="y" unit="%" tick={{ fontSize: 11, fill: "#8a8f98" }} axisLine={false} tickLine={false} />
                    <ZAxis type="number" dataKey="z" range={[80, 400]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ payload }) => {
                        const d = payload?.[0]?.payload as (typeof scatter)[number] | undefined;
                        return d ? (
                          <div className={s.tip}>
                            <b>{d.name}</b>
                            <span>
                              적합도 {FIT_LABEL[d.fit]} · 절감률 {d.y}% · 완료 {d.z}기능
                            </span>
                          </div>
                        ) : null;
                      }}
                    />
                    {(["H", "M", "L"] as const).map((f) => (
                      <Scatter key={f} data={scatter.filter((x) => x.fit === f)} fill={FIT_COLOR[f]} fillOpacity={0.8} />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className={s.note}>선정 지표가 맞았다면 상 → 하 로 갈수록 절감률이 낮아지는 경향이 보여야 합니다. 점 크기 = 완료 기능 수.</p>
            </Panel>
          </div>

          <Panel eyebrow="By project" title="과제별 비교" flush>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>과제</th>
                  <th>적합도</th>
                  <th className={s.r}>완료/기능</th>
                  <th className={s.r}>A</th>
                  <th className={s.r}>B</th>
                  <th className={s.r}>절감률</th>
                  <th className={s.r}>기능당 총비용</th>
                  <th className={s.r}>비용 차이</th>
                  <th className={s.r}>결함률 A→B</th>
                  <th className={s.r}>사후 수정률</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p) => {
                  const ms = mx.byProject[p.prjId];
                  return (
                    <tr key={p.prjId}>
                      <td>
                        <Link href={`/projects/${p.prjId}?tab=measure`} className={s.plink}>
                          {p.prjNm}
                        </Link>
                      </td>
                      <td>{p.finalFit !== "NA" ? <FitBadge fit={p.finalFit} size="sm" /> : <FitBadge fit={p.suggestFit} confirmed={false} size="sm" />}</td>
                      {ms ? (
                        <>
                          <td className={`${s.r} num`}>
                            {ms.doneCount}/{ms.featureCount}
                          </td>
                          <td className={`${s.r} num`}>{hours(ms.sumA)}</td>
                          <td className={`${s.r} num`}>{hours(ms.sumB)}</td>
                          <td className={`${s.r} num`}>
                            <b>{pct(ms.savingRate)}</b>
                          </td>
                          <td className={`${s.r} num`}>{won(ms.costPerFeature)}</td>
                          <td className={`${s.r} num`}>{won(ms.costDiffPerFeature)}</td>
                          <td className={`${s.r} num`}>
                            {ms.defectRateA?.toFixed(2) ?? "—"} → {ms.defectRateB?.toFixed(2) ?? "—"}
                          </td>
                          <td className={`${s.r} num`}>{pct(ms.postFixRate, 1)}</td>
                        </>
                      ) : (
                        <td colSpan={8} className="subtle">
                          기능 미등록
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
          {type && <p className={s.note}>유형 필터: {types[type]}</p>}
        </>
      )}
    </>
  );
}
