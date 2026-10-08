import type { Store } from "./store/types";
import type { HistoryEntry } from "./types";

export async function record(
  store: Store,
  actor: { userId: string; userNm: string },
  e: Pick<HistoryEntry, "targetTyp" | "targetId" | "actionCd" | "summary"> & { diff?: unknown },
): Promise<void> {
  await store.history.add({
    targetTyp: e.targetTyp,
    targetId: e.targetId,
    actionCd: e.actionCd,
    summary: e.summary,
    diff: e.diff ?? null,
    userId: actor.userId,
    userNm: actor.userNm,
    regAt: new Date().toISOString(),
  });
}
