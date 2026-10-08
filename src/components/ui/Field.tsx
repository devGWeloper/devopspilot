"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { FIT_COLOR } from "@/lib/labels";
import type { Level } from "@/lib/types";
import s from "./ui.module.css";

export function Field({
  label,
  required,
  hint,
  error,
  children,
  htmlFor,
  id,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
  id?: string;
}) {
  return (
    <div className={s.field} id={id} data-error={error ? "true" : undefined}>
      <label className={s.label} htmlFor={htmlFor}>
        {label}
        {required && <span className={s.req}>*</span>}
      </label>
      {children}
      {error ? <span className={s.error}>{error}</span> : hint ? <span className={s.hint}>{hint}</span> : null}
    </div>
  );
}

export function TextInput({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...rest} className={`${s.input} ${invalid ? s.invalid : ""} ${className ?? ""}`} />;
}

export function Select({
  invalid,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select {...rest} className={`${s.select} ${invalid ? s.invalid : ""} ${className ?? ""}`}>
      {children}
    </select>
  );
}

export function Textarea({ invalid, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...rest} className={`${s.textarea} ${invalid ? s.invalid : ""} ${className ?? ""}`} />;
}

export function Checkbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={s.check}>
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}

export interface RadioOption {
  id: string;
  label: string;
  hint?: string;
  level?: Level;
}

export function RadioCards({
  name,
  options,
  value,
  onChange,
  disabled,
  invalid,
}: {
  name: string;
  options: RadioOption[];
  value: string | undefined;
  onChange: (id: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className={s.radioGroup} role="radiogroup" aria-label={name} style={invalid ? { outline: "2px solid var(--danger-soft)", borderRadius: 10 } : undefined}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          aria-disabled={disabled}
          className={s.radioCard}
          onClick={() => !disabled && onChange(o.id)}
        >
          <span className={s.radioMark} />
          <span className={s.radioLabel}>
            {o.label}
            {o.level && <span className={s.levelDot} style={{ background: FIT_COLOR[o.level] }} title={`수준 ${o.level}`} />}
          </span>
          {o.hint && <span className={s.radioHint}>{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}
