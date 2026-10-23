import { SettingsTabs } from "@/features/master/SettingsTabs";
import { pageActor } from "@/lib/auth/server";
import { metricDefs } from "@/lib/measure/metrics";
import { getSettings } from "@/lib/measure/service";
import { getStore } from "@/lib/store";

export const metadata = { title: "단가·기준정보" };

export default async function Page() {
  await pageActor();
  const settings = await getSettings(await getStore());
  return <SettingsTabs settings={settings} metrics={metricDefs(settings.mdHours)} />;
}
