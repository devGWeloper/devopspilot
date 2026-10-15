import { ResultDashboard } from "@/features/dashboard/ResultDashboard";
import { pageActor } from "@/lib/auth/server";
import { loadIndex } from "@/lib/measure/service";
import { getStore } from "@/lib/store";
import { dashView, type DashFilter } from "@/lib/views";

export const metadata = { title: "측정 결과" };

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const actor = await pageActor();
  const ix = await loadIndex(await getStore());
  const filter: DashFilter = {
    kind: searchParams.kind === "개발" || searchParams.kind === "운영" ? searchParams.kind : "",
    prjId: searchParams.prj ?? "",
    includeIng: searchParams.ing === "1",
  };
  const scope = actor.role === "DEVELOPER" ? "내가 담당한 요구사항 기준" : "전체 요구사항";
  return <ResultDashboard vm={dashView(ix, actor, filter)} scopeNote={`${scope} · ${filter.includeIng ? "측정 완료 + 측정 중" : "측정 완료"}`} />;
}
