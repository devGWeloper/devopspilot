import { MasterTabs } from "@/features/master/MasterTabs";
import { pageActor } from "@/lib/auth/server";
import { metricDefs } from "@/lib/measure/metrics";
import { loadIndex } from "@/lib/measure/service";
import { getStore } from "@/lib/store";
import { statusView } from "@/lib/views";

export const metadata = { title: "기준 데이터" };

export default async function Page() {
  const actor = await pageActor();
  const store = await getStore();
  const [ix, users] = await Promise.all([loadIndex(store), store.users.list()]);
  const devs = users.filter((u) => u.role === "DEVELOPER" && u.useYn).map((u) => ({ userId: u.userId, userNm: u.userNm }));
  return <MasterTabs vm={{ projects: statusView(ix, actor).projects, devs, settings: ix.data.settings, metrics: metricDefs(ix.data.settings.mdHours) }} />;
}
