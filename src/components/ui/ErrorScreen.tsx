import type { ReactNode } from "react";

export function ErrorScreen({ code, title, message, children }: { code: string; title: string; message: string; children?: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="eyebrow">Error {code}</span>
        <h1 className="h1">{title}</h1>
        <p className="muted">{message}</p>
        <div style={{ marginTop: 8, fontWeight: 650, color: "var(--accent)" }}>{children}</div>
      </div>
    </div>
  );
}
