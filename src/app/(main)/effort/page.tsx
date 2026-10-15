import { EffortBoard } from "@/features/effort/EffortBoard";
import { pageActor } from "@/lib/auth/server";
import { loadIndex, todayKst } from "@/lib/measure/service";
import { getStore } from "@/lib/store";
import { effortView } from "@/lib/views";

export const metadata = { title: "투입 공수" };

export default async function Page() {
  const actor = await pageActor();
  const store = await getStore();
  const [ix, users] = await Promise.all([loadIndex(store), store.users.list()]);
  return <EffortBoard vm={effortView(ix, actor, users)} me={{ userId: actor.userId, role: actor.role }} today={todayKst()} />;
}
