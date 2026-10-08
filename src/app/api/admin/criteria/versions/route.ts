import { fail, ok } from "@/lib/api";
import { getVersion, listVersions } from "@/lib/criteria/admin";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = route(async ({ req, store }) => {
  const v = new URL(req.url).searchParams.get("v");
  if (!v) return ok(await listVersions(store));
  const c = await getVersion(store, Number(v));
  return c ? ok(c) : fail(404, "NOT_FOUND", "해당 버전이 없습니다.");
});
