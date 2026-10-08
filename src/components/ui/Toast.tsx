"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./ui.module.css";

interface ToastItem {
  id: number;
  text: string;
  error: boolean;
}

const Ctx = createContext<{ toast: (text: string) => void; toastError: (text: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, error: boolean) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, error }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), error ? 6000 : 3200);
  }, []);
  const toast = useCallback((t: string) => push(t, false), [push]);
  const toastError = useCallback((t: string) => push(t, true), [push]);
  return (
    <Ctx.Provider value={{ toast, toastError }}>
      {children}
      <div className={s.toasts} aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`${s.toast} ${t.error ? s.toastErr : ""}`}>
            <Icon name={t.error ? "alert" : "check"} size={16} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("ToastProvider missing");
  return v;
}
