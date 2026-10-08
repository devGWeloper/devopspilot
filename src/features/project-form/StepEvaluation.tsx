"use client";

import { useState } from "react";
import { Field, RadioCards, Textarea } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import type { ProjectInput } from "@/lib/projects/validate";
import type { Criteria } from "@/lib/types";
import d from "../project-detail/detail.module.css";
import s from "./form.module.css";

export function StepEvaluation({
  input,
  update,
  criteria,
  errOf,
}: {
  input: ProjectInput;
  update: (p: Partial<ProjectInput>) => void;
  criteria: Criteria;
  errOf: (f: string) => string | null;
}) {
  const [openNotes, setOpenNotes] = useState<Set<string>>(() => new Set(Object.keys(input.notes)));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {criteria.areas.map((a, ai) => (
        <Panel key={a.id} eyebrow={`0${ai + 1} · ${a.question}`} title={a.name}>
          <div className={s.indList}>
            {a.indicators.map((ind) => {
              const err = errOf(`answer.${ind.id}`);
              const noteOpen = openNotes.has(ind.id);
              return (
                <div key={ind.id} className={s.ind} data-error={err ? "true" : undefined}>
                  <div className={s.indHead}>
                    <div>
                      <div className={d.indName}>
                        {ind.name}
                        {ind.tier === "MAJOR" && <span className={d.major}>MAJOR</span>}
                      </div>
                      <div className={d.indDesc}>{ind.description}</div>
                    </div>
                    <button
                      type="button"
                      className={s.noteToggle}
                      onClick={() => setOpenNotes((x) => new Set(noteOpen ? [...x].filter((k) => k !== ind.id) : [...x, ind.id]))}
                    >
                      {noteOpen ? "메모 닫기" : input.notes[ind.id] ? "메모 보기" : "+ 메모"}
                    </button>
                  </div>
                  <RadioCards
                    name={ind.name}
                    options={ind.options}
                    value={input.answers[ind.id]}
                    onChange={(oid) => update({ answers: { ...input.answers, [ind.id]: oid } })}
                    invalid={!!err}
                  />
                  {err && <span className="sr-only">{err}</span>}
                  {err && <span style={{ color: "var(--danger)", fontSize: 12, fontWeight: 600 }}>{err}</span>}
                  {noteOpen && (
                    <Field label="보충 메모">
                      <Textarea
                        rows={2}
                        value={input.notes[ind.id] ?? ""}
                        maxLength={1000}
                        onChange={(e) => update({ notes: { ...input.notes, [ind.id]: e.target.value } })}
                        placeholder="판단 근거나 예외 상황을 적어 주세요"
                      />
                    </Field>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}
    </div>
  );
}
