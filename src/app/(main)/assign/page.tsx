import { AssignBoard } from "@/features/master/AssignBoard";
import { pageActor } from "@/lib/auth/server";
import { loadIndex } from "@/lib/measure/service";
import { getStore } from "@/lib/store";
import { statusView } from "@/lib/views";

export const metadata = { title: "공수 입력 관리" };

export default async function Page() {
  const actor = await pageActor();
  const store = await getStore();
  const [ix, users] = await Promise.all([loadIndex(store), store.users.list()]);
  const devs = users.filter((u) => u.role === "DEVELOPER" && u.useYn).map((u) => ({ userId: u.userId, userNm: u.userNm }));
  return <AssignBoard projects={statusView(ix, actor).projects} devs={devs} />;
}
