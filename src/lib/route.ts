import type { NextResponse } from "next/server";
import { handle } from "./api";
import { requireUser, type ActorFull } from "./auth/guard";
import { getStore } from "./store";
import type { Store } from "./store/types";

export interface Ctx<P> {
  req: Request;
  actor: ActorFull;
  store: Store;
  params: P;
}

// 모든 라우트가 같은 순서(인증 → 저장소 → 처리)와 같은 오류 응답을 쓰게 한다.
export function route<P = Record<string, string>>(fn: (c: Ctx<P>) => Promise<NextResponse>) {
  return handle(async (req: Request, ctx?: { params: P }) => {
    const g = await requireUser();
    if (!g.ok) return g.res;
    return fn({ req, actor: g.actor, store: await getStore(), params: (ctx?.params ?? {}) as P });
  });
}
