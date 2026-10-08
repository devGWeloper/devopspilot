"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import s from "./ui.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const V: Record<Variant, string> = {
  primary: s.btnPrimary,
  secondary: s.btnSecondary,
  ghost: s.btnGhost,
  danger: s.btnDanger,
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
  icon?: IconName;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={[s.btn, V[variant], size === "sm" ? s.btnSm : "", className ?? ""].join(" ")}
    >
      {loading ? <span className={s.spinner} /> : icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null}
      {children}
    </button>
  );
}
