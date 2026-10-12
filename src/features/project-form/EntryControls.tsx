"use client";

import { useState, type ReactNode } from "react";
import { Field, RadioCards, Select, Textarea, TextInput } from "@/components/ui/Field";
import { FIT_LABEL } from "@/lib/fitness";
import { PM_FIT_HINT, type EntryField } from "@/lib/projects/fields";
import { fieldValue, type ProjectInput } from "@/lib/projects/validate";
import { LEVELS, type CodeItem, type Codes, type Indicator, type ProjectBase } from "@/lib/types";
import s from "./form.module.css";

export interface StepProps {
  input: ProjectInput;
  update: (p: Partial<ProjectInput>) => void;
  errOf: (f: string) => string | null;
}

export function RefTag({ id, portal }: { id?: string; portal?: boolean }) {
  if (!id) return null;
  return (
    <span className={s.ref} title={portal ? "과제 선정 양식에 없는 포털 추가 항목" : "과제 선정 양식 항목 ID"}>
      {portal ? "포털" : id}
    </span>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={s.section}>
      <header className={s.sectionHead}>
        <h3>{title}</h3>
        {aside}
      </header>
      <div className={s.formGrid}>{children}</div>
    </section>
  );
}

function hintOf(c: CodeItem): string | undefined {
  if (!c.desc && !c.example) return undefined;
  return [c.desc, c.example ? `예) ${c.example}` : null].filter(Boolean).join(" · ");
}

// 정의가 붙은 코드나 선택지가 적은 코드는 카드로 펼쳐 정의를 읽고 고르게 하고, 긴 목록만 드롭다운으로 둔다.
function asCards(list: CodeItem[]): boolean {
  return list.some((c) => c.desc) || list.length <= 4;
}

export function EntryFieldControl({
  f,
  input,
  update,
  errOf,
  codes,
  required,
}: StepProps & { f: EntryField; codes: Codes; required?: boolean }) {
  const v = fieldValue(input, f);
  const err = errOf(f.key);
  const set = (val: unknown) => {
    if (f.key === "prjNm" || f.key === "sysNm") update({ [f.key]: val as string });
    else update({ base: { ...input.base, [f.key]: val } as ProjectBase });
  };
  const label = (
    <>
      <RefTag id={f.ref} portal={f.portal} />
      {f.name}
    </>
  );
  const req = required ?? f.required;
  const id = `f-${f.key}`;

  if (f.kind === "codes" && f.codes) {
    const list = codes[f.codes];
    const vals = (v as string[]) ?? [];
    return (
      <div className={s.full}>
        <Field label={label} required={req} error={err} hint={f.guide}>
          <div className={s.chips} role="group" aria-label={f.name}>
            {list.map((c) => {
              const idx = vals.indexOf(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  className={s.chipBtn}
                  aria-pressed={idx >= 0}
                  onClick={() => set(idx >= 0 ? vals.filter((x) => x !== c.code) : [...vals, c.code])}
                >
                  {idx === 0 && <span className={s.mainTag}>주</span>}
                  {c.label}
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    );
  }

  if (f.kind === "code" && f.codes) {
    const list = codes[f.codes];
    if (asCards(list)) {
      return (
        <div className={s.full} data-error={err ? "true" : undefined}>
          <Field label={label} required={req} error={err} hint={f.guide}>
            <RadioCards
              name={f.name}
              options={list.map((c) => ({ id: c.code, label: c.label, hint: hintOf(c) }))}
              value={(v as string) || undefined}
              onChange={set}
              invalid={!!err}
            />
          </Field>
        </div>
      );
    }
    return (
      <Field label={label} required={req} error={err} hint={f.guide} htmlFor={id}>
        <Select id={id} value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} invalid={!!err}>
          <option value="">선택</option>
          {list.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
    );
  }

  if (f.kind === "level") {
    return (
      <div className={s.full} data-error={err ? "true" : undefined}>
        <Field label={label} required={req} error={err} hint={f.guide}>
          <RadioCards
            name={f.name}
            options={LEVELS.map((lv) => ({ id: lv, label: FIT_LABEL[lv], hint: PM_FIT_HINT[lv] }))}
            value={(v as string) || undefined}
            onChange={set}
            invalid={!!err}
          />
        </Field>
      </div>
    );
  }

  if (f.kind === "textarea") {
    return (
      <div className={s.full}>
        <Field label={label} required={req} error={err} hint={f.guide} htmlFor={id}>
          <Textarea id={id} rows={3} value={(v as string) ?? ""} maxLength={f.max} onChange={(e) => set(e.target.value)} invalid={!!err} placeholder={f.placeholder} />
        </Field>
      </div>
    );
  }

  if (f.kind === "number") {
    return (
      <Field label={label} required={req} error={err} hint={f.guide} htmlFor={id}>
        <TextInput
          id={id}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={v === null || v === undefined ? "" : String(v)}
          onChange={(e) => set(e.target.value.trim() === "" ? null : Math.floor(Number(e.target.value)))}
          invalid={!!err}
        />
      </Field>
    );
  }

  return (
    <Field label={label} required={req} error={err} hint={f.guide} htmlFor={id}>
      <TextInput id={id} value={(v as string) ?? ""} maxLength={f.max} onChange={(e) => set(e.target.value)} invalid={!!err} placeholder={f.placeholder} />
    </Field>
  );
}

export function IndicatorField({ ind, input, update, errOf }: StepProps & { ind: Indicator }) {
  const [noteOpen, setNoteOpen] = useState(() => !!input.notes[ind.id]);
  const err = errOf(`answer.${ind.id}`);
  return (
    <div className={`${s.full} ${s.ind}`} data-error={err ? "true" : undefined}>
      <div className={s.indHead}>
        <div>
          <div className={s.indName}>
            <RefTag id={ind.ref} />
            {ind.name}
            <span className={s.req} aria-label="필수">
              *
            </span>
            <span className={ind.tier === "MAJOR" ? s.tierMajor : s.tierMinor} title={ind.tier === "MAJOR" ? "적합도 등급을 정하는 지표" : "등급은 바꾸지 않고 보완 신호로만 쓰는 지표"}>
              {ind.tier === "MAJOR" ? "MAJOR" : "MINOR"}
            </span>
          </div>
          <div className={s.indDesc}>{ind.description}</div>
        </div>
        <button type="button" className={s.noteToggle} onClick={() => setNoteOpen((x) => !x)}>
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
      {err && <span className={s.errText}>{err}</span>}
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
}
