"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/apiClient";
import type { OrgCd, Role } from "@/lib/types";

export interface Me {
  userId: string;
  userNm: string;
  role: Role;
  orgCd: OrgCd;
  deptNm: string;
}

export interface Meta {
  storeKind: "oracle" | "json";
  aiEnabled: boolean;
  criteriaVersion: number;
  criteriaPublishedAt: string | null;
  configError: string | null;
}

interface AuthValue {
  me: Me | null;
  meta: Meta | null;
  loading: boolean;
  error: string | null;
  refreshMeta: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMeta = useCallback(async () => {
    setMeta(await api<Meta>("/api/meta"));
  }, []);

  useEffect(() => {
    Promise.all([api<Me>("/api/auth/me"), api<Meta>("/api/meta")])
      .then(([m, mt]) => {
        setMe(m);
        setMeta(mt);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return <Ctx.Provider value={{ me, meta, loading, error, refreshMeta }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
