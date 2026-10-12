import { Fragment, type ReactNode } from "react";
import { Chip } from "@/components/ui/Chip";
import { Panel } from "@/components/ui/Panel";
import { labelOf } from "@/lib/hooks";
import { fmtDate } from "@/lib/labels";
import { FIT_LABEL } from "@/lib/fitness";
import { areasOfStep, ENTRY_STEPS, fieldsOfStep, STEP, type EntryField } from "@/lib/projects/fields";
import { REPLAY_PHASES, type Codes, type Criteria, type Level, type Project, type ReplayPhase } from "@/lib/types";
import s from "./detail.module.css";

export const PHASE_NAME: Record<ReplayPhase, string> = { ANALYSIS: "분석", DESIGN: "설계", DEV: "개발", TEST: "테스트" };
const PHASE_COLOR: Record<ReplayPhase, string> = { ANALYSIS: "#c5cbea", DESIGN: "#8c9cf0", DEV: "#2b3a8c", TEST: "#14213d" };

export function OverviewTab({ p, codes, criteria }: { p: Project; codes: Codes | null; criteria?: Criteria | null }) {
  const b = p.base;
  const bl = b.baseline;
  const show = (f: EntryField): ReactNode => {
    const v = f.key === "prjNm" || f.key === "sysNm" ? p[f.key] : b[f.key];
    if (f.kind === "codes" && f.codes) {
      const list = v as string[];
      return list.length ? (
        <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
          {list.map((l, i) => (
            <Chip key={l} tone={i === 0 ? "accent" : "outline"}>
              {labelOf(codes?.[f.codes!], l)}
            </Chip>
          ))}
        </span>
      ) : (
        "—"
      );
    }
    if (f.kind === "code" && f.codes) return labelOf(codes?.[f.codes], v as string);
    if (f.kind === "level") return v ? FIT_LABEL[v as Level] : "—";
    if (v === null || v === undefined || v === "") return "—";
    return String(v);
  };
  const phaseSum = REPLAY_PHASES.reduce((sum, ph) => sum + (bl.phaseMm[ph] ?? 0), 0);
  return (
    <div className={s.grid2}>
      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        {[STEP.PROJECT, STEP.PLAN, STEP.STAFF].map((st) => (
          <Panel key={st} eyebrow={["① 과제", "", "③ AI 적용 계획", "", "⑤ 참여 인력"][st]} title={ENTRY_STEPS[st]}>
            <dl className={s.dl}>
              {fieldsOfStep(st).map((f) => (
                <Fragment key={f.key}>
                  <dt>
                    <span className={s.refId}>{f.portal ? "포털" : f.ref}</span>
                    {f.name}
                  </dt>
                  <dd style={f.kind === "textarea" ? { fontWeight: 400, whiteSpace: "pre-wrap" } : undefined}>{show(f)}</dd>
                </Fragment>
              ))}
              {st === STEP.PROJECT && (
                <>
                  <dt>
                    <span className={s.refId}>PRJ-05</span>작성자 (PM)
                  </dt>
                  <dd>{p.pmUserNm}</dd>
                </>
              )}
              {criteria &&
                areasOfStep(criteria, st)
                  .flatMap((a) => a.indicators)
                  .map((ind) => (
                    <Fragment key={ind.id}>
                      <dt>
                        <span className={s.refId}>{ind.ref ?? "지표"}</span>
                        {ind.name}
                      </dt>
                      <dd>{ind.options.find((o) => o.id === p.eval.answers[ind.id])?.label ?? <span className="subtle">미입력</span>}</dd>
                    </Fragment>
                  ))}
            </dl>
          </Panel>
        ))}
      </div>
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
