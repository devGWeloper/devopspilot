import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { labelOf } from "@/lib/hooks";
import { fmtDate } from "@/lib/labels";
import { REPLAY_PHASES, type Codes, type Project, type ReplayPhase } from "@/lib/types";
import s from "./detail.module.css";

export const PHASE_NAME: Record<ReplayPhase, string> = { ANALYSIS: "분석", DESIGN: "설계", DEV: "개발", TEST: "테스트" };
const PHASE_COLOR: Record<ReplayPhase, string> = { ANALYSIS: "#c5cbea", DESIGN: "#8c9cf0", DEV: "#2b3a8c", TEST: "#14213d" };

export function OverviewTab({ p, codes }: { p: Project; codes: Codes | null }) {
  const b = p.base;
  const bl = b.baseline;
  const phaseSum = REPLAY_PHASES.reduce((sum, ph) => sum + (bl.phaseMm[ph] ?? 0), 0);
  return (
    <div className={s.grid2}>
      <Panel eyebrow="Profile" title="기본 정보">
        <dl className={s.dl}>
          <dt>시스템명</dt>
          <dd>{p.sysNm || "—"}</dd>
          <dt>업무 도메인</dt>
          <dd>{labelOf(codes?.domains, b.domainCd)}</dd>
          <dt>시스템 유형</dt>
          <dd>{labelOf(codes?.sysTypes, b.sysTypeCd)}</dd>
          <dt>주 개발 언어</dt>
          <dd style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {b.langCds.length
              ? b.langCds.map((l, i) => (
                  <Chip key={l} tone={i === 0 ? "accent" : "outline"}>
                    {labelOf(codes?.langs, l)}
                  </Chip>
                ))
              : "—"}
          </dd>
          <dt>기술 스택</dt>
          <dd>{b.techStack || "—"}</dd>
          <dt>담당 조직</dt>
          <dd>{b.orgNm || "—"}</dd>
          <dt>과제 PM</dt>
          <dd>{p.pmUserNm}</dd>
          <dt>과제 설명</dt>
          <dd style={{ fontWeight: 400 }}>{b.description || "—"}</dd>
        </dl>
      </Panel>
      <Panel eyebrow="Baseline" title="원 프로젝트 실적">
        <dl className={s.dl}>
          <dt>수행 기간</dt>
          <dd>
            {fmtDate(bl.startDate)} ~ {fmtDate(bl.endDate)}
          </dd>
          <dt>총 투입 공수</dt>
          <dd className="num">{bl.totalMm !== null ? `${bl.totalMm} M/M` : "—"}</dd>
        </dl>
        {phaseSum > 0 && (
          <div style={{ marginTop: 16 }}>
            <span className="eyebrow">단계별 공수</span>
            <div className={s.phaseBar} aria-hidden>
              {REPLAY_PHASES.map((ph) =>
                bl.phaseMm[ph] ? (
                  <span key={ph} style={{ width: `${((bl.phaseMm[ph] ?? 0) / phaseSum) * 100}%`, background: PHASE_COLOR[ph] }} />
                ) : null,
              )}
            </div>
            <div className={s.phaseLegend}>
              {REPLAY_PHASES.map((ph) => (
                <span key={ph}>
                  <span className="muted">
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: PHASE_COLOR[ph], marginRight: 5 }} />
                    {PHASE_NAME[ph]}
                  </span>
                  <b className="num">{bl.phaseMm[ph] ?? "—"}</b>
                </span>
              ))}
            </div>
          </div>
        )}
        <dl className={s.dl} style={{ marginTop: 18 }}>
          <dt>산출물 규모</dt>
          <dd className="num">
            {[bl.screens !== null ? `화면 ${bl.screens}` : null, bl.programs !== null ? `프로그램 ${bl.programs}` : null, bl.loc !== null ? `${bl.loc.toLocaleString()} LOC` : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </dd>
          <dt>Replay 대상</dt>
          <dd style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {bl.replayPhases.length ? bl.replayPhases.map((ph) => <Chip key={ph}>{PHASE_NAME[ph]}</Chip>) : "—"}
          </dd>
        </dl>
      </Panel>
    </div>
  );
}
