import { AdminTabs } from "@/features/admin/AdminTabs";
import { pageActor } from "@/lib/auth/server";
import { loadConfig } from "@/lib/config";
import { loadIndex, todayKst } from "@/lib/measure/service";
import { recentWeekdays } from "@/lib/store/sampleData";
import { getStore } from "@/lib/store";
import { collectLog, confMatrix } from "@/lib/views";

export const metadata = { title: "시스템 관리" };

export default async function Page() {
  await pageActor();
  const store = await getStore();
  const [ix, users] = await Promise.all([loadIndex(store), store.users.list()]);
  // 오늘 포함 최근 평일 10일 중 측정 시작일 이후만
  const days = [...recentWeekdays(9), todayKst()].filter((d) => d >= ix.data.settings.measureStart);
  return (
    <AdminTabs
      conf={confMatrix(ix, users, days, new Date().toISOString())}
      collect={collectLog(ix, users)}
      otelOn={!!loadConfig().collectToken}
    />
  );
}
