import { fromResult } from "@/lib/api";
import { route } from "@/lib/route";
import { resetPassword } from "@/lib/users/service";

export const POST = route<{ id: string }>(async ({ actor, store, params }) => fromResult(await resetPassword(store, actor, params.id)));
