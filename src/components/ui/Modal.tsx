"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./ui.module.css";

export function Modal({
  open,
  title,
  eyebrow,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: ReactNode;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={s.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${s.modal} ${wide ? s.modalWide : ""}`} role="dialog" aria-modal="true">
        <div className={s.modalHead}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 className="h2" style={{ fontSize: 18 }}>
              {title}
            </h2>
          </div>
          <button aria-label="닫기" onClick={onClose} style={{ border: 0, background: "none", color: "var(--muted)", padding: 4 }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className={s.modalBody}>{children}</div>
        {footer && <div className={s.modalFoot}>{footer}</div>}
      </div>
    </div>
  );
}
