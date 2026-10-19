import { fail, fromResult, readJson } from "@/lib/api";
import { route } from "@/lib/route";
import type { UserRecord } from "@/lib/types";
import { updateUser } from "@/lib/users/service";

export const PUT = route<{ id: string }>(async ({ req, actor, store, params }) => {
  const body = await readJson<Partial<Pick<UserRecord, "userNm" | "orgCd" | "hqNm" | "deptNm" | "role" | "useYn" | "aiAcct">>>(req);
  if (!body) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await updateUser(store, actor, params.id, body));
});
