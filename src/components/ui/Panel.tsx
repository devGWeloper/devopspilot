import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import s from "./ui.module.css";

export function Panel({
  eyebrow,
  title,
  actions,
  children,
  flush,
  className,
  style,
  id,
}: {
  eyebrow?: string;
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
  style?: CSSProperties;
  id?: string;
}) {
  return (
    <section className={`${s.panel} ${className ?? ""}`} style={style} id={id}>
      {(eyebrow || title || actions) && (
        <header className={s.panelHead}>
          <div className={s.panelHeadText}>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            {title && <h2 className="h2">{title}</h2>}
          </div>
          {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
        </header>
      )}
      <div className={flush ? s.panelFlush : s.panelBody}>{children}</div>
    </section>
  );
}

export function KpiTile({
  label,
  value,
  unit,
  sub,
  children,
  onClick,
  hint = "계산 보기",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
  hint?: string;
}) {
  const body = (
    <>
      <span className={s.kpiLabel}>
        <span className="eyebrow">{label}</span>
        {onClick && (
          <span className={s.kpiHint}>
            {hint} <Icon name="chevronRight" size={12} />
          </span>
        )}
      </span>
      <div>
        <span className={s.kpiValue}>{value}</span>
        {unit && <span className={s.kpiUnit}>{unit}</span>}
      </div>
      {sub && <span className={s.kpiSub}>{sub}</span>}
      {children}
    </>
  );
  return onClick ? (
    <button type="button" className={`${s.kpi} ${s.kpiHit}`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={s.kpi}>{body}</div>
  );
}

export function EmptyState({ icon = "folder", title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className={s.empty}>
      <span className={s.emptyIcon}>
        <Icon name={icon} size={20} />
      </span>
      <span className={s.emptyTitle}>{title}</span>
      {children && <span style={{ maxWidth: 420 }}>{children}</span>}
    </div>
  );
}

export function Skeleton({ h = 16, w = "100%", style }: { h?: number; w?: number | string; style?: CSSProperties }) {
  return <div className={s.skeleton} style={{ height: h, width: w, ...style }} />;
}

export function Callout({
  tone = "info",
  icon,
  children,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  icon?: IconName;
  children: ReactNode;
}) {
  const ic: IconName = icon ?? (tone === "ok" ? "check" : tone === "info" ? "info" : "alert");
  return (
    <div className={`${s.callout} ${s[`callout-${tone}`]}`} role={tone === "danger" ? "alert" : undefined}>
      <span style={{ flex: "none", marginTop: 2 }}>
        <Icon name={ic} size={16} />
      </span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
