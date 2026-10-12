"use client";

import { Checkbox, Field, TextInput } from "@/components/ui/Field";
import { Callout, Panel } from "@/components/ui/Panel";
import { baselineRequired, type ProjectInput } from "@/lib/projects/validate";
import { REPLAY_PHASES, type ProjectBaseline, type ReplayPhase } from "@/lib/types";
import { PHASE_NAME } from "../project-detail/OverviewTab";
import s from "./form.module.css";

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function StepBaseline({
  input,
  update,
  errOf,
}: {
  input: ProjectInput;
  update: (p: Partial<ProjectInput>) => void;
  errOf: (f: string) => string | null;
}) {
  const bl = input.base.baseline;
  const req = baselineRequired(input);
  const set = (patch: Partial<ProjectBaseline>) => update({ base: { ...input.base, baseline: { ...bl, ...patch } } });
  const phaseSum = REPLAY_PHASES.reduce((a, p) => a + (bl.phaseMm[p] ?? 0), 0);
  const mismatch = bl.totalMm !== null && phaseSum > 0 && Math.abs(phaseSum - bl.totalMm) > 0.05;

  function togglePhase(p: ReplayPhase) {
    set({ replayPhases: bl.replayPhases.includes(p) ? bl.replayPhases.filter((x) => x !== p) : [...bl.replayPhases, p] });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Callout tone="info">
        원 프로젝트(AI 없이 수행)의 실적은 Replay 테스트 결과와 비교할 <b>기준선</b>입니다. 기능 단위 실적은 선정 후 측정 단계에서 따로
        입력하며, 여기서는 과제 전체 규모를 적습니다.
      </Callout>
      {!req && (
        <Callout tone="warn">
          기존 WBS 실적이 <b>없음</b>으로 입력돼 수행 기간·총 공수는 필수가 아닙니다. 공수 산정서 등 다른 근거가 있으면 적어 주세요.
        </Callout>
      )}
      <Panel eyebrow="Replay 기준선" title="원 프로젝트 실적">
        <div className={s.formGrid}>
          <Field label="수행 시작일" required={req} htmlFor="sd" error={errOf("baseline.period")}>
            <TextInput id="sd" type="date" value={bl.startDate ?? ""} onChange={(e) => set({ startDate: e.target.value || null })} />
          </Field>
          <Field label="수행 종료일" required={req} htmlFor="ed">
            <TextInput id="ed" type="date" value={bl.endDate ?? ""} onChange={(e) => set({ endDate: e.target.value || null })} />
          </Field>
          <Field label="총 투입 공수 (M/M)" required={req} htmlFor="mm" error={errOf("baseline.totalMm") ?? errOf("baseline")}>
            <TextInput id="mm" type="number" min={0} step={0.1} inputMode="decimal" value={bl.totalMm ?? ""} onChange={(e) => set({ totalMm: num(e.target.value) })} />
          </Field>
          <div />
          <div className={s.full}>
            <Field
              label="단계별 공수 (M/M)"
              hint={
                phaseSum > 0 ? (
                  <span style={mismatch ? { color: "var(--warn)", fontWeight: 600 } : undefined}>
                    단계 합계 {Math.round(phaseSum * 10) / 10} M/M{mismatch ? ` — 총 공수(${bl.totalMm})와 다릅니다` : ""}
                  </span>
                ) : (
                  "알 수 있는 단계만 입력해도 됩니다."
                )
              }
            >
              <div className={s.phaseInputs}>
                {REPLAY_PHASES.map((p) => (
                  <label key={p} className={s.phaseInput}>
                    <span>{PHASE_NAME[p]}</span>
                    <TextInput
                      type="number"
                      min={0}
                      step={0.1}
                      inputMode="decimal"
                      value={bl.phaseMm[p] ?? ""}
                      onChange={(e) => set({ phaseMm: { ...bl.phaseMm, [p]: num(e.target.value) } })}
                      aria-label={`${PHASE_NAME[p]} 공수`}
                    />
                  </label>
                ))}
              </div>
            </Field>
          </div>
          <Field label="화면 수" htmlFor="scr">
            <TextInput id="scr" type="number" min={0} value={bl.screens ?? ""} onChange={(e) => set({ screens: num(e.target.value) })} />
          </Field>
          <Field label="프로그램 수" htmlFor="pgm">
            <TextInput id="pgm" type="number" min={0} value={bl.programs ?? ""} onChange={(e) => set({ programs: num(e.target.value) })} />
          </Field>
          <Field label="코드 규모 (LOC)" htmlFor="loc">
            <TextInput id="loc" type="number" min={0} value={bl.loc ?? ""} onChange={(e) => set({ loc: num(e.target.value) })} />
          </Field>
          <div />
          <div className={s.full}>
            <Field label="Replay 대상 단계" required error={errOf("baseline.replayPhases")} hint="요구분석·고객협의는 비교에서 제외하는 것이 원칙입니다.">
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                {REPLAY_PHASES.map((p) => (
                  <Checkbox key={p} label={PHASE_NAME[p]} checked={bl.replayPhases.includes(p)} onChange={() => togglePhase(p)} />
                ))}
              </div>
            </Field>
          </div>
        </div>
      </Panel>
    </div>
  );
}
