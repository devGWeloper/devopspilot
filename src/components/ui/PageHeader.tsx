import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="h1">{title}</h1>
          {description && (
            <p className="muted" style={{ maxWidth: 760 }}>
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {actions}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}
