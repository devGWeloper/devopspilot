"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
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
