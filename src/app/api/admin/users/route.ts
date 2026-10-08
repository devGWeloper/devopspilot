import { fail, fromResult, ok, readJson } from "@/lib/api";
import { can } from "@/lib/auth/permissions";
import { route } from "@/lib/route";
import { createUser, toPublic, type UserInput } from "@/lib/users/service";

export const dynamic = "force-dynamic";

export const GET = route(async ({ actor, store }) => {
  if (!can(actor, "users.manage")) return fail(403, "FORBIDDEN", "권한이 없습니다.");
  return ok((await store.users.list()).map(toPublic));
});

export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<UserInput>(req);
  if (!body) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await createUser(store, actor, body), 201);
});
