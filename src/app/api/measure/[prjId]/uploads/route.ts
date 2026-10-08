import { ok } from "@/lib/api";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = route<{ prjId: string }>(async ({ store, params }) => {
  return ok(await store.history.list({ targetTyp: "UPLOAD", targetId: params.prjId, limit: 100 }));
});
