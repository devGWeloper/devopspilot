import { fromResult } from "@/lib/api";
import { publishDraft } from "@/lib/criteria/admin";
import { route } from "@/lib/route";

export const POST = route(async ({ actor, store }) => fromResult(await publishDraft(store, actor)));
