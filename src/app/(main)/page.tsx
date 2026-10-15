import { StatusBoard } from "@/features/status/StatusBoard";
import { pageActor } from "@/lib/auth/server";
import { loadIndex } from "@/lib/measure/service";
import { getStore } from "@/lib/store";
import { statusView } from "@/lib/views";

export const metadata = { title: "PoC 과제 현황" };

export default async function Page() {
  const actor = await pageActor();
  const store = await getStore();
  const ix = await loadIndex(store);
  const admin = actor.role === "ADMIN";
  const devs = admin
    ? (await store.users.list()).filter((u) => u.role === "DEVELOPER" && u.useYn).map((u) => ({ userId: u.userId, userNm: u.userNm }))
    : [];
  return <StatusBoard vm={statusView(ix, actor)} canManage={admin} devs={devs} workTypes={ix.data.settings.workTypes} />;
}
