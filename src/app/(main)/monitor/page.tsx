import { MonitorBoard } from "@/features/monitor/MonitorBoard";
import { pageActor } from "@/lib/auth/server";
import { listNotes, loadIndex, todayKst } from "@/lib/measure/service";
import { getStore } from "@/lib/store";
import { monitorView } from "@/lib/views";

export const metadata = { title: "공수 모니터링" };

export default async function Page() {
  await pageActor();
  const store = await getStore();
  const [ix, users, notes] = await Promise.all([loadIndex(store), store.users.list(), listNotes(store)]);
  return <MonitorBoard vm={monitorView(ix, users, notes, todayKst())} />;
}
