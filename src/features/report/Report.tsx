"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { AgreementSeal } from "@/components/ui/AgreementSeal";
import { Button } from "@/components/ui/Button";
import { FitPair } from "@/components/ui/FitBadge";
import { Callout, Skeleton } from "@/components/ui/Panel";
import { ProfileStrip } from "@/components/ui/ProfileStrip";
import { analyzeBalance } from "@/lib/balance";
import { buildProfile, evaluateFit, FIT_LABEL } from "@/lib/fitness";
import { labelOf, optionLabel, useApi, useRefs } from "@/lib/hooks";
import { AGREE_LABEL, FIT_COLOR, fmtDate, fmtDateTime, STATUS_LABEL } from "@/lib/labels";
import { DEV_TYPE_INDICATOR, LEVELS, type Project } from "@/lib/types";
import { BalanceMatrix } from "../dashboard/BalanceMatrix";
import { ruleSentences } from "../project-detail/RationaleTab";
import s from "./report.module.css";

export function Report() {
  const { me } = useAuth();
  const { criteria, codes } = useRefs();
  const { data: projects, error } = useApi<Project[]>("/api/projects");

  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!projects || !criteria || !codes) return <Skeleton h={500} />;

  const now = new Date().toISOString();
  const balance = analyzeBalance(projects, criteria, codes);
  const chosen = projects.filter((p) => p.status === "SELECTED" || p.status === "RESERVE").sort((a, b) => (a.status === b.status ? a.prjId.localeCompare(b.prjId) : a.status === "SELECTED" ? -1 : 1));
  const live = projects.filter((p) => p.status !== "EXCLUDED");

  return (
    <div className={s.report}>
      <div className={`${s.toolbar} no-print`}>
        <span className="muted">A4 가로로 인쇄됩니다. 브라우저 인쇄 창에서 'PDF로 저장'을 선택하면 PDF 로 받을 수 있습니다.</span>
        <Button variant="primary" icon="print" onClick={() => window.print()}>
          인쇄 · PDF
        </Button>
      </div>

      <section className={`${s.page} ${s.cover}`}>
        <span className={s.coverKicker}>SK hynix × SK AX</span>
        <h1 className={s.coverTitle}>AI 활용 생산성 향상 PoC</h1>
        <p className={s.coverSub}>Replay 테스트 대상 과제 선정 결과</p>
        <dl className={s.coverMeta}>
          <div>
            <dt>평가 기준</dt>
            <dd>
              v{criteria.version} {criteria.publishedAt ? `(${fmtDate(criteria.publishedAt)} 게시)` : ""}
            </dd>
          </div>
          <div>
            <dt>출력</dt>
            <dd>
              {fmtDateTime(now)} · {me?.userNm}
            </dd>
          </div>
          <div>
            <dt>후보 / 선정 / 예비</dt>
            <dd className="num">
              {live.length} / {balance.selectedCount} / {projects.filter((p) => p.status === "RESERVE").length}건
            </dd>
          </div>
        </dl>
        <div className={s.summaryRow}>
          {LEVELS.map((lv) => (
            <div key={lv} className={s.summaryCell}>
              <span style={{ color: FIT_COLOR[lv] }}>적합도 {FIT_LABEL[lv]}</span>
              <b className="num">{balance.byFit[lv]}</b>
              <span className="subtle">목표 {codes.target.byFit[lv]}</span>
            </div>
          ))}
          <div className={s.summaryCell}>
            <span>균형 경고</span>
            <b className="num">{balance.warnings.length}</b>
            <span className="subtle">{balance.warnings.length ? "아래 참조" : "모두 충족"}</span>
          </div>
        </div>
        {balance.warnings.length > 0 && (
          <ul className={s.warns}>
            {balance.warnings.map((w) => (
              <li key={w.message}>{w.message}</li>
            ))}
          </ul>
        )}
      </section>

      <section className={s.page}>
        <h2 className={s.h2}>1. 포트폴리오 균형 — 적합도 × 개발 성격</h2>
        <p className={s.lead}>채운 칩은 선정, 테두리 칩은 후보입니다. 빗금 칸은 선정 과제가 없는 유형입니다.</p>
        <BalanceMatrix projects={projects} criteria={criteria} codes={codes} compact />
      </section>

      <section className={s.page}>
        <h2 className={s.h2}>2. 선정·예비 과제</h2>
        <table className={s.table}>
          <thead>
            <tr>
              <th>코드</th>
              <th>과제</th>
              <th>구분</th>
              <th>적합도</th>
              <th>지표 프로필</th>
              <th>판정 근거</th>
              <th>개발 성격 · 언어 · 도메인</th>
              <th>합의</th>
            </tr>
          </thead>
          <tbody>
            {chosen.map((p) => {
              const ev = evaluateFit(criteria, p.eval.answers);
              return (
                <tr key={p.prjId}>
                  <td className="num">{p.prjId}</td>
                  <td>
                    <b>{p.prjNm}</b>
                    <div className="subtle">
                      {p.sysNm} · PM {p.pmUserNm}
                    </div>
                  </td>
                  <td>{STATUS_LABEL[p.status]}</td>
                  <td>
                    <FitPair finalFit={p.finalFit} suggestFit={p.suggestFit} size="sm" />
                  </td>
                  <td>
                    <ProfileStrip profile={buildProfile(criteria, p.eval.answers)} size="sm" />
                  </td>
                  <td className={s.small}>
                    {ev.ruleText}
                    {p.eval.confirm?.reason && <div className="subtle">확정 사유: {p.eval.confirm.reason}</div>}
                  </td>
                  <td className={s.small}>
                    {optionLabel(criteria, DEV_TYPE_INDICATOR, p.devTypeCd)} · {labelOf(codes.langs, p.mainLangCd)} · {labelOf(codes.domains, p.domainCd)}
                  </td>
                  <td>
                    <AgreementSeal ax={p.axAgree} hx={p.hxAgree} />
                    <div className={`${s.small} subtle`}>
                      AX {AGREE_LABEL[p.axAgree]} · HX {AGREE_LABEL[p.hxAgree]}
                    </div>
                  </td>
                </tr>
              );
            })}
            {chosen.length === 0 && (
              <tr>
                <td colSpan={8} className="muted" style={{ textAlign: "center", padding: 24 }}>
                  선정·예비 과제가 아직 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className={s.page}>
        <h2 className={s.h2}>부록. 평가 기준 v{criteria.version}</h2>
        <ul className={s.rules}>
          {ruleSentences(criteria).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className={s.appendix}>
          {criteria.areas.map((a) => (
            <div key={a.id} className={s.appArea}>
              <h3>
                {a.name} <span className="subtle">— {a.question}</span>
              </h3>
              <table className={s.table}>
                <tbody>
                  {a.indicators.map((i) => (
                    <tr key={i.id}>
                      <td style={{ width: "34%" }}>
                        <b>{i.name}</b> {i.tier === "MAJOR" && <span className={s.major}>MAJOR</span>}
                      </td>
                      <td className={s.small}>
                        {i.options.map((o) => (
                          <span key={o.id} style={{ marginRight: 10, whiteSpace: "nowrap" }}>
                            <span style={{ color: FIT_COLOR[o.level] }}>●</span> {o.label}({FIT_LABEL[o.level]})
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
