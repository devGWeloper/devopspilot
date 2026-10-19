import { EffortBoard } from "@/features/effort/EffortBoard";
import { pageActor } from "@/lib/auth/server";
import { loadIndex, todayKst } from "@/lib/measure/service";
import { getStore } from "@/lib/store";
import { effortView } from "@/lib/views";

export const metadata = { title: "공수 입력" };

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const actor = await pageActor();
  const store = await getStore();
  const [ix, users] = await Promise.all([loadIndex(store), store.users.list()]);
  const dev = actor.role === "DEVELOPER";
  // 관리자·열람자는 개발자를 골라 조회만 한다.
  const userId = dev ? actor.userId : (searchParams.u ?? users.find((u) => u.role === "DEVELOPER" && u.useYn)?.userId ?? "");
  // 개발자를 바꾸면 선택한 요구사항 상태도 새로 시작하도록 key 를 준다.
  return <EffortBoard key={userId} vm={effortView(ix, users, userId, todayKst())} editable={dev} />;
}
