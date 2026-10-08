import type { ReactNode } from "react";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/labels";
import type { ProjectStatus } from "@/lib/types";
import s from "./ui.module.css";

export type Tone = "neutral" | "accent" | "info" | "ok" | "warn" | "danger" | "outline";

export function Chip({ tone = "neutral", dot, children, title }: { tone?: Tone; dot?: boolean; children: ReactNode; title?: string }) {
  return (
    <span className={`${s.chip} ${s[`tone-${tone}`]}`} title={title}>
      {dot && <span className={s.chipDot} />}
      {children}
    </span>
  );
}

export function StatusChip({ status }: { status: ProjectStatus }) {
  return (
    <Chip tone={STATUS_TONE[status]} dot>
      {STATUS_LABEL[status]}
    </Chip>
  );
}
