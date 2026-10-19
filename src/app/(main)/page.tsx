import { StatusBoard } from "@/features/status/StatusBoard";
import { pageActor } from "@/lib/auth/server";
import { loadIndex } from "@/lib/measure/service";
import { getStore } from "@/lib/store";
import { statusView } from "@/lib/views";

export const metadata = { title: "PoC 과제 현황" };

export default async function Page() {
  const actor = await pageActor();
  const ix = await loadIndex(await getStore());
  return <StatusBoard vm={statusView(ix, actor)} canManage={actor.role === "ADMIN"} />;
}
