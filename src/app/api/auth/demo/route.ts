import { handle, ok } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { getStore } from "@/lib/store";
import { DEMO_PASSWORD, SEED_ADMIN } from "@/lib/store/seed";

export const dynamic = "force-dynamic";

// 로그인 전 화면에 노출되므로 JSON(로컬 데모) 모드에서만 계정 목록을 준다. 운영 DB 계정은 절대 내려주지 않는다.
export const GET = handle(async () => {
  const store = await getStore();
  if (store.kind !== "json") return ok({ demo: false, accounts: [] });
  const users = await store.users.list();
  return ok({
    demo: true,
    accounts: users
      .filter((u) => u.useYn)
      .map((u) => ({
        userId: u.userId,
        userNm: u.userNm,
        role: ROLE_LABEL[u.role],
        password: u.userId === SEED_ADMIN.userId ? SEED_ADMIN.password : DEMO_PASSWORD,
      })),
  });
});
