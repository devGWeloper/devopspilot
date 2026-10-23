import { NAV } from "@/components/shell/nav";
import { VocBoard } from "@/features/voc/VocBoard";
import { pageActor } from "@/lib/auth/server";
import { getStore } from "@/lib/store";
import { listVoc } from "@/lib/voc/service";

export const metadata = { title: "개선 요청" };

export default async function Page() {
  const actor = await pageActor();
  const items = await listVoc(await getStore());
  const pages = NAV.flatMap((g) => g.items.map((i) => i.label)).filter((l) => l !== "개선 요청");
  return <VocBoard items={items} me={actor.userId} admin={actor.role === "ADMIN"} pages={pages} />;
}
