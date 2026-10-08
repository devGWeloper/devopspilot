import { ok } from "@/lib/api";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async ({ store, params }) => {
  return ok(await store.history.list({ targetTyp: "PROJECT", targetId: params.id, limit: 200 }));
});
