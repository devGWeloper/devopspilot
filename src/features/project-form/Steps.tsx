"use client";

import { Field, Select } from "@/components/ui/Field";
import { FitBadge } from "@/components/ui/FitBadge";
import { Callout, Panel } from "@/components/ui/Panel";
import type { FitEvaluation } from "@/lib/fitness";
import { FIT_LABEL } from "@/lib/fitness";
import { areasOfStep, fieldsOfStep, sectionsOf, STEP, type EntryField } from "@/lib/projects/fields";
import { remarkRequired } from "@/lib/projects/validate";
import type { Area, Codes, Criteria } from "@/lib/types";
import { EntryFieldControl, IndicatorField, RefTag, Section, type StepProps } from "./EntryControls";
import s from "./form.module.css";

interface Ctx extends StepProps {
  codes: Codes;
  criteria: Criteria;
}

function Fields({ fields, ctx, required }: { fields: EntryField[]; ctx: Ctx; required?: (f: EntryField) => boolean | undefined }) {
  return (
    <>
      {fields.map((f) => (
        <EntryFieldControl key={f.key} f={f} {...ctx} required={required?.(f)} />
      ))}
    </>
  );
}

function AreaSection({ area, ctx }: { area: Area; ctx: Ctx }) {
  const filled = area.indicators.filter((i) => i.options.some((o) => o.id === ctx.input.answers[i.id])).length;
  return (
    <Section
      title={area.name}
      aside={
        <span className={s.count} data-done={filled === area.indicators.length ? "true" : undefined}>
          {filled}/{area.indicators.length} 선택
        </span>
      }
    >
      {area.indicators.map((ind) => (
        <IndicatorField key={ind.id} ind={ind} input={ctx.input} update={ctx.update} errOf={ctx.errOf} />
      ))}
    </Section>
  );
}

export function StepProject({ ctx, pms, isAdmin, pmName }: { ctx: Ctx; pms: { userId: string; userNm: string; deptNm: string }[]; isAdmin: boolean; pmName: string }) {
  const sections = sectionsOf(fieldsOfStep(STEP.PROJECT));
  const areas = areasOfStep(ctx.criteria, STEP.PROJECT);
  return (
    <Panel eyebrow="① 과제" title="과제 정보">
      {sections.map(([title, fields], i) => (
        <Section key={title} title={title}>
          <Fields fields={fields} ctx={ctx} />
          {i === 0 &&
            (isAdmin ? (
              <Field label={<><RefTag id="PRJ-05" />작성자 (PM)</>} required htmlFor="pm" error={ctx.errOf("pmUserId")}>
                <Select id="pm" value={ctx.input.pmUserId ?? ""} onChange={(e) => ctx.update({ pmUserId: e.target.value })} invalid={!!ctx.errOf("pmUserId")}>
                  <option value="">선택</option>
                  {pms.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.userNm} ({u.userId}
                      {u.deptNm ? ` · ${u.deptNm}` : ""})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label={<><RefTag id="PRJ-05" />작성자 (PM)</>} hint="로그인한 계정으로 자동 기록됩니다.">
                <div className={s.readonly}>{pmName}</div>
              </Field>
            ))}
        </Section>
      ))}
      {areas.map((a) => (
        <AreaSection key={a.id} area={a} ctx={ctx} />
      ))}
    </Panel>
  );
}

export function StepPlan({ ctx }: { ctx: Ctx }) {
  return (
    <Panel eyebrow="③ AI 적용 계획" title="AI 적용 계획">
      {sectionsOf(fieldsOfStep(STEP.PLAN)).map(([title, fields]) => (
        <Section key={title} title={title} aside={title.includes("참고") ? <span className="subtle" style={{ fontSize: 12 }}>선택 입력</span> : undefined}>
          <Fields fields={fields} ctx={ctx} />
        </Section>
      ))}
    </Panel>
  );
}

export function StepFit({ ctx, ev }: { ctx: Ctx; ev: FitEvaluation | null }) {
  const fields = fieldsOfStep(STEP.FIT);
  const areas = areasOfStep(ctx.criteria, STEP.FIT);
  const pmFit = ctx.input.base.pmFit;
  const differs = !!pmFit && !!ev && ev.suggest !== "NA" && pmFit !== ev.suggest;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Callout tone="info">
        개발자가 <b>MAJOR</b> 3개 항목을 평가하면, 가장 낮은 항목이 <b>참고 등급</b>을 정합니다(양식 FIT-05). PM 은 참고 등급과 병목 항목을 보고 예상 기대효과를
        판단하고, 최종 적합도는 AX 가 확정합니다. 상·중·하는 과제마다 하나입니다.
      </Callout>
      <Panel eyebrow="④ AI 적합도" title="AI 적합도">
        {areas.map((a, i) => (
          <div key={a.id}>
            <AreaSection area={a} ctx={ctx} />
            {i === 0 && (
              <div className={s.formGrid} style={{ marginBottom: 8 }}>
                <Fields fields={fields.filter((f) => f.section === "개발자 평가")} ctx={ctx} />
              </div>
            )}
          </div>
        ))}

        <section className={s.refGrade} aria-live="polite">
          <div className={s.refGradeHead}>
            <RefTag id="FIT-05" />
            <b>참고 등급</b>
            <span className="subtle">자동 · 입력하지 않음</span>
          </div>
          {ev && ev.suggest !== "NA" ? (
            <div className={s.refGradeBody}>
              <FitBadge fit={ev.suggest} confirmed={false} />
              <span>
                {ev.bottleneck.length ? (
                  <>
                    병목: <b>{ev.bottleneck.join(", ")}</b>
                  </>
                ) : (
                  "세 항목 모두 유리"
                )}
              </span>
              {ev.minorLows.length > 0 && <span className="subtle">· 보완 신호(Minor 하): {ev.minorLows.join(", ")}</span>}
            </div>
          ) : (
            <p className="subtle" style={{ margin: 0 }}>
              MAJOR 항목을 모두 고르면 참고 등급이 표시됩니다.
            </p>
          )}
        </section>

        <Section title="PM 판단">
          <Fields fields={fields.filter((f) => f.section === "PM 판단")} ctx={ctx} />
          {differs && (
            <div className={s.full}>
              <Callout tone="warn">
                참고 등급({FIT_LABEL[ev!.suggest]})과 다르게 판단했습니다. 판단 사유에 그렇게 본 근거를 적어 주세요.
              </Callout>
            </div>
          )}
        </Section>
      </Panel>
    </div>
  );
}

export function StepStaff({ ctx }: { ctx: Ctx }) {
  const sections = sectionsOf(fieldsOfStep(STEP.STAFF));
  const areas = areasOfStep(ctx.criteria, STEP.STAFF);
  const needRemark = remarkRequired(ctx.input);
  return (
    <Panel eyebrow="⑤ 참여 인력" title="참여 인력">
      {sections.map(([title, fields], i) => (
        <div key={title}>
          <Section title={title}>
            <Fields fields={fields} ctx={ctx} required={(f) => (f.key === "remark" ? needRemark : undefined)} />
          </Section>
          {i === 0 && areas.map((a) => <AreaSection key={a.id} area={a} ctx={ctx} />)}
        </div>
      ))}
    </Panel>
  );
}
