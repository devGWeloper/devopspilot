"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/components/auth/AuthProvider";
import { Icon } from "@/components/ui/Icon";
import { Callout, EmptyState, KpiTile, Panel, Skeleton } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { analyzeBalance, effectiveFit } from "@/lib/balance";
import { useApi, useRefs } from "@/lib/hooks";
import { FIT_COLOR, FIT_LABEL, fmtRelative } from "@/lib/labels";
import { LEVELS, type CodeItem, type HistoryEntry, type Project } from "@/lib/types";
import { BalanceMatrix } from "./BalanceMatrix";
import s from "./dashboard.module.css";

interface DashData {
  myTasks: { prjId: string; prjNm: string; reason: string }[];
  activity: HistoryEntry[];
}

function distRows(codes: CodeItem[], ps: Project[], key: (p: Project) => string | null) {
  return codes
    .map((c) => ({
      label: c.label,
      후보: ps.filter((p) => p.status !== "EXCLUDED" && key(p) === c.code).length,
      선정: ps.filter((p) => p.status === "SELECTED" && key(p) === c.code).length,
    }))
    .filter((r) => r.후보 > 0);
}

function Distribution({ title, rows }: { title: string; rows: { label: string; 후보: number; 선정: number }[] }) {
  return (
    <div>
      <span className="eyebrow">{title}</span>
      <div style={{ height: Math.max(120, rows.length * 34 + 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }} barGap={2}>
            <CartesianGrid horizontal={false} stroke="#ece9e1" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#8a8f98" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={118} tick={{ fontSize: 12, fill: "#2c3854" }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "rgba(43,58,140,0.05)" }} contentStyle={{ borderRadius: 8, border: "1px solid #e4e1d8", fontSize: 12 }} />
            <Legend iconType="square" iconSize={9} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="후보" fill="#c5cbea" radius={[0, 3, 3, 0]} barSize={10} />
            <Bar dataKey="선정" fill="#2b3a8c" radius={[0, 3, 3, 0]} barSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { me } = useAuth();
  const { criteria, codes } = useRefs();
  const { data: projects, error } = useApi<Project[]>("/api/projects");
  const { data: dash } = useApi<DashData>("/api/dashboard");

  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!projects || !criteria || !codes) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Skeleton h={28} w={240} />
        <Skeleton h={120} />
        <Skeleton h={360} />
      </div>
    );
  }

  const live = projects.filter((p) => p.status !== "EXCLUDED");
  const submitted = projects.filter((p) => !["DRAFT", "SUPPLEMENT"].includes(p.status)).length;
  const confirmed = projects.filter((p) => p.finalFit !== "NA");
  const balance = analyzeBalance(projects, criteria, codes);
  const target = codes.target.total;
  const consider = projects.filter((p) => ["REVIEW", "SELECTED", "RESERVE"].includes(p.status));
  const hxAgreed = consider.filter((p) => p.hxAgree === "AGREE").length;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="PoC 과제 선정 현황"
        description="AI 활용 생산성 향상 측정을 위한 Replay PoC 대상 과제입니다. 생산성 효과가 과대·과소평가되지 않도록 적합도 상·중·하와 과제 유형을 고르게 선정합니다."
      />

      <section className={s.kpis}>
        <KpiTile label="후보 과제" value={live.length} unit="건" sub={`제외 ${projects.length - live.length}건 별도`} />
        <KpiTile label="제출 완료" value={submitted} unit="건" sub={`작성중·보완 ${projects.length - submitted}건`} />
        <KpiTile label="적합도 확정" value={confirmed.length} unit="건">
          <div className={s.fitMini}>
            {LEVELS.map((lv) => {
              const n = confirmed.filter((p) => p.finalFit === lv).length;
              return (
                <span key={lv} title={`${FIT_LABEL[lv]} ${n}건`} style={{ flex: Math.max(n, 0.0001), background: FIT_COLOR[lv] }} />
              );
            })}
          </div>
          <span className={s.fitMiniLegend}>
            {LEVELS.map((lv) => (
              <span key={lv}>
                {FIT_LABEL[lv]} <b className="num">{confirmed.filter((p) => p.finalFit === lv).length}</b>
              </span>
            ))}
          </span>
        </KpiTile>
        <KpiTile label="선정 확정" value={balance.selectedCount} unit={`/ ${target}건`}>
          <div className={s.progress}>
            <span style={{ width: `${Math.min(100, (balance.selectedCount / Math.max(1, target)) * 100)}%` }} />
          </div>
        </KpiTile>
        <KpiTile
          label="하이닉스 합의율"
          value={consider.length ? Math.round((hxAgreed / consider.length) * 100) : 0}
          unit="%"
          sub={`검토·선정·예비 ${consider.length}건 중 ${hxAgreed}건 동의`}
        />
      </section>

      <div className={s.mainGrid}>
        <Panel
          eyebrow="Portfolio balance"
          title="적합도 × 과제 유형"
          actions={
            <Link href="/selection" className={s.link}>
              선정 보드 <Icon name="chevronRight" size={14} />
            </Link>
          }
        >
          <BalanceMatrix projects={projects} criteria={criteria} codes={codes} />
        </Panel>
        <div className={s.side}>
          <Panel eyebrow="Balance check" title="균형 점검">
            {balance.warnings.length ? (
              <ul className={s.warnList}>
                {balance.warnings.map((w) => (
                  <li key={w.message}>
                    <Icon name="alert" size={14} /> {w.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.good}>
                <Icon name="check" size={14} /> 선정 목표와 균형 기준을 모두 충족했습니다.
              </p>
            )}
            <div className={s.fitTargets}>
              {LEVELS.map((lv) => (
                <div key={lv}>
                  <span style={{ color: FIT_COLOR[lv], fontWeight: 700 }}>{FIT_LABEL[lv]}</span>
                  <b className="num">{balance.byFit[lv]}</b>
                  <span className="subtle">/ {codes.target.byFit[lv]}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel eyebrow="To do" title="내 할 일">
            {dash?.myTasks.length ? (
              <ul className={s.tasks}>
                {dash.myTasks.map((t) => (
                  <li key={t.prjId}>
                    <Link href={`/projects/${t.prjId}`}>
                      <b>{t.prjNm}</b>
                      <span>{t.reason}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>
                {me?.role === "PM" ? "작성 중이거나 보완 요청된 과제가 없습니다." : "처리할 항목이 없습니다."}
              </p>
            )}
          </Panel>
        </div>
      </div>

      <div className={s.bottomGrid}>
        <Panel eyebrow="Distribution" title="후보 대비 선정 분포">
          <div className={s.charts}>
            <Distribution title="주 개발 언어" rows={distRows(codes.langs, projects, (p) => p.mainLangCd)} />
            <Distribution title="시스템 유형" rows={distRows(codes.sysTypes, projects, (p) => p.sysTypeCd)} />
          </div>
        </Panel>
        <Panel eyebrow="Activity" title="최근 활동">
          {dash?.activity.length ? (
            <ul className={s.feed}>
              {dash.activity.map((h) => (
                <li key={h.histId}>
                  <span className={s.feedDot} />
                  <div>
                    <Link href={`/projects/${h.targetId}`}>
                      <b>{h.userNm}</b> · {h.summary}
                    </Link>
                    <span className="subtle">
                      {h.targetId} · {fmtRelative(h.regAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="history" title="아직 활동이 없습니다" />
          )}
        </Panel>
      </div>
      <p className="subtle" style={{ fontSize: 12, marginTop: 16 }}>
        적합도는 AX 확정값을 우선하고, 미확정 과제는 판정 규칙의 제안값으로 집계합니다. 미평가 과제{" "}
        {projects.filter((p) => effectiveFit(p) === "NA").length}건은 매트릭스에서 제외됩니다.
      </p>
    </>
  );
}
