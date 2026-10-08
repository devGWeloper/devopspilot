"use client";

import type { ReactNode } from "react";
import s from "./ui.module.css";

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
}

export function Tabs<K extends string>({ items, value, onChange }: { items: TabItem<K>[]; value: K; onChange: (k: K) => void }) {
  return (
    <div className={s.tabs} role="tablist">
      {items.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={t.key === value}
          className={`${s.tab} ${t.key === value ? s.tabActive : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count !== undefined && <span className={s.tabCount}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { key: K; label: ReactNode }[];
  value: K;
  onChange: (k: K) => void;
  ariaLabel?: string;
}) {
  return (
    <div className={s.seg} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.key}
          role="radio"
          aria-checked={o.key === value}
          className={`${s.segBtn} ${o.key === value ? s.segBtnActive : ""}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
