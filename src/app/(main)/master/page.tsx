import { MasterTabs } from "@/features/master/MasterTabs";
import { pageActor } from "@/lib/auth/server";
import { loadIndex } from "@/lib/measure/service";
import { getStore } from "@/lib/store";
import { statusView } from "@/lib/views";

export const metadata = { title: "과제 선정 관리" };

export default async function Page({ searchParams }: { searchParams: { import?: string } }) {
  const actor = await pageActor();
  const store = await getStore();
  const ix = await loadIndex(store);
  return <MasterTabs vm={{ projects: statusView(ix, actor).projects, workTypes: ix.data.settings.workTypes }} openImport={searchParams.import === "1"} />;
}
