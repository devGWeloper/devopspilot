import { fromResult } from "@/lib/api";
import { reevaluateAll } from "@/lib/projects/service";
import { route } from "@/lib/route";

export const POST = route(async ({ actor, store }) => fromResult(await reevaluateAll(store, actor)));
