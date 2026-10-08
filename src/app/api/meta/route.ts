import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { loadConfig } from "@/lib/config";
import { getStore } from "@/lib/store";
import type { Criteria } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const store = await getStore();
  const c = (await store.config.get<Criteria>("CRITERIA"))?.value;
  const cfg = loadConfig();
  return ok({
    storeKind: store.kind,
    aiEnabled: cfg.llm.enabled,
    criteriaVersion: c?.version ?? 1,
    criteriaPublishedAt: c?.publishedAt ?? null,
    configError: cfg.loadError,
  });
});
