import { Panel } from "@/components/ui/Panel";
import { FIT_COLOR, FIT_LABEL, FIT_SOFT } from "@/lib/labels";
import type { Criteria, Level, Project } from "@/lib/types";
import s from "./detail.module.css";

export function LevelTag({ level }: { level: Level | null }) {
  if (!level) return <span className={s.lv} style={{ background: "var(--fit-na-soft)", color: "var(--fit-na)" }}>—</span>;
  return (
    <span className={s.lv} style={{ background: FIT_SOFT[level], color: FIT_COLOR[level] }}>
      {FIT_LABEL[level]}
    </span>
  );
}

export function EvaluationTab({ p, criteria }: { p: Project; criteria: Criteria }) {
  return (
    <div className={s.areaGrid}>
      {criteria.areas.map((a, ai) => (
        <Panel key={a.id} eyebrow={`0${ai + 1} · ${a.question}`} title={a.name}>
          {a.indicators.map((ind) => {
            const opt = ind.options.find((o) => o.id === p.eval.answers[ind.id]);
            const note = p.eval.notes[ind.id];
            return (
              <div key={ind.id} className={s.indRow}>
                <div>
                  <div className={s.indName}>
                    {ind.ref && <span className={s.refId}>{ind.ref}</span>}
                    {ind.name}
                    <span className={ind.tier === "MAJOR" ? s.major : s.minor}>{ind.tier}</span>
                  </div>
                  <div className={s.indDesc}>{ind.description}</div>
                </div>
                <span className={s.answer}>{opt ? opt.label : <span className="subtle">미입력</span>}</span>
                {note && <div className={s.indNote}>{note}</div>}
              </div>
            );
          })}
        </Panel>
      ))}
    </div>
  );
}
