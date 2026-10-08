import { FitBadge } from "@/components/ui/FitBadge";
import { Callout, Panel } from "@/components/ui/Panel";
import { ProfileStrip } from "@/components/ui/ProfileStrip";
import { evaluateFit } from "@/lib/fitness";
import { FIT_LABEL, fmtDateTime } from "@/lib/labels";
import type { Criteria, Project } from "@/lib/types";
import s from "./detail.module.css";
import { LevelTag } from "./EvaluationTab";

export function ruleSentences(c: Criteria): string[] {
  const r = c.rule;
  const high = r.highMinMajorHigh === "half" ? "과반" : `${r.highMinMajorHigh}개`;
  return [
    `Major 지표 중 하가 ${r.lowMinMajorLow}개 이상이면 하`,
    `Major 지표 중 하가 ${r.highMaxMajorLow}개 이하이고 상이 ${high} 이상이면 상`,
    "그 외는 중 — Minor 지표는 판정을 바꾸지 않고 보완 신호로만 표시",
  ];
}

export function RationaleTab({ p, criteria }: { p: Project; criteria: Criteria }) {
  const ev = evaluateFit(criteria, p.eval.answers);
  const majors = ev.profile.filter((x) => x.tier === "MAJOR");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Panel eyebrow="Judgement" title="판정 결과">
        <div className={s.ruleBox}>
          <FitBadge fit={ev.suggest} confirmed={false} size="lg" />
          <div>
            <div className={s.ruleText}>{ev.ruleText}</div>
            <div className={s.counts}>
              <span>
                Major 상<b className="num">{ev.majorCount.H}</b>
              </span>
              <span>
                중<b className="num">{ev.majorCount.M}</b>
              </span>
              <span>
                하<b className="num">{ev.majorCount.L}</b>
              </span>
              <span>
                미응답<b className="num">{ev.majorCount.total - ev.majorCount.answered}</b>
              </span>
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <ProfileStrip profile={ev.profile} size="lg" />
          </div>
        </div>
        <ul style={{ margin: "14px 0 0", paddingLeft: 18, color: "var(--muted)", fontSize: 13 }}>
          {ruleSentences(criteria).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Panel>

      <div className={s.grid2}>
        <Panel eyebrow="Major indicators" title="Major 지표">
          {majors.map((m) => (
            <div key={m.indicatorId} className={s.indRow}>
              <span style={{ fontWeight: 600 }}>{m.indicatorName}</span>
              <span className={s.answer}>
                {m.optionLabel ?? <span className="subtle">미응답</span>}
                <LevelTag level={m.level} />
              </span>
            </div>
          ))}
        </Panel>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Panel eyebrow="Signals" title="Minor 보완 신호">
            {ev.minorLows.length ? (
              <Callout tone="warn">
                하 수준인 Minor 지표: <b>{ev.minorLows.join(", ")}</b>
                <br />
                적합도에는 반영되지 않지만 Replay 수행 전에 보완하면 측정 신뢰도가 올라갑니다.
              </Callout>
            ) : (
              <p className="muted">하 수준인 Minor 지표가 없습니다.</p>
            )}
          </Panel>
          <Panel eyebrow="Confirmation" title="확정 기록">
            {p.eval.confirm ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <FitBadge fit={p.eval.confirm.fit} />
                  <span>
                    <b>{p.eval.confirm.byNm}</b> <span className="subtle">· {fmtDateTime(p.eval.confirm.at)}</span>
                  </span>
                </div>
                {p.eval.confirm.fit !== ev.suggest && ev.suggest !== "NA" && (
                  <span className="muted" style={{ fontSize: 13 }}>
                    제안({FIT_LABEL[ev.suggest]})과 다르게 확정됨
                  </span>
                )}
                {p.eval.confirm.reason && <p style={{ whiteSpace: "pre-wrap" }}>{p.eval.confirm.reason}</p>}
              </div>
            ) : (
              <p className="muted">아직 AX 관리자가 적합도를 확정하지 않았습니다.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
