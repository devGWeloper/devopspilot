import { ok } from "@/lib/api";
import { getPublishedCriteria } from "@/lib/criteria/service";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = route(async ({ store }) => ok(await getPublishedCriteria(store)));
