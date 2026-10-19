import { Guide } from "@/features/guide/Guide";
import { pageActor } from "@/lib/auth/server";
import { metricDefs } from "@/lib/measure/metrics";
import { getSettings } from "@/lib/measure/service";
import { getStore } from "@/lib/store";

export const metadata = { title: "작성 가이드" };

export default async function Page() {
  const actor = await pageActor();
  const settings = await getSettings(await getStore());
  return <Guide role={actor.role} metrics={metricDefs(settings.mdHours)} />;
}
