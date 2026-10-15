import { EffortDay } from "@/features/effort/EffortDay";
import { pageActor } from "@/lib/auth/server";
import { loadIndex, todayKst } from "@/lib/measure/service";
import { getStore } from "@/lib/store";
import { effortDayView } from "@/lib/views";

export const metadata = { title: "공수 입력" };

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const actor = await pageActor();
  const store = await getStore();
  const [ix, users] = await Promise.all([loadIndex(store), store.users.list()]);
  const dev = actor.role === "DEVELOPER";
  // 관리자·열람자는 개발자를 골라 조회만 한다.
  const userId = dev ? actor.userId : (searchParams.u ?? users.find((u) => u.role === "DEVELOPER" && u.useYn)?.userId ?? "");
  return <EffortDay vm={effortDayView(ix, users, userId, searchParams.d ?? null, todayKst())} editable={dev} />;
}
