import { SelectionDashboard } from "@/features/selection/SelectionDashboard";
import { pageActor } from "@/lib/auth/server";
import { loadIndex } from "@/lib/measure/service";
import { getStore } from "@/lib/store";
import { selectionView } from "@/lib/views";

export const metadata = { title: "과제 선정 현황" };

export default async function Page() {
  const actor = await pageActor();
  const ix = await loadIndex(await getStore());
  return <SelectionDashboard vm={selectionView(ix, actor)} />;
}
