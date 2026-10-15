"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { OrgCd, Role } from "@/lib/types";

export interface Me {
  userId: string;
  userNm: string;
  role: Role;
  orgCd: OrgCd;
  deptNm: string;
}

interface AuthValue {
  me: Me;
  storeKind: "oracle" | "json";
}

const Ctx = createContext<AuthValue | null>(null);

// 로그인 사용자는 서버 레이아웃이 이미 읽었으므로 그대로 내려받는다 — 화면마다 /api/auth/me 왕복을 기다리지 않게.
export function AuthProvider({ me, storeKind, children }: AuthValue & { children: ReactNode }) {
  return <Ctx.Provider value={{ me, storeKind }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
