import { ok } from "@/lib/api";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = route(async ({ store }) => {
  const activity = await store.history.list({ targetTyp: "PROJECT", limit: 12 });
  return ok({ activity });
});
