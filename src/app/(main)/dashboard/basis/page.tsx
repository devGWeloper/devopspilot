import { BasisView } from "@/features/dashboard/BasisView";
import { pageActor } from "@/lib/auth/server";
import { loadIndex } from "@/lib/measure/service";
import { getStore } from "@/lib/store";
import { basisView, type DashFilter } from "@/lib/views";

export const metadata = { title: "산출 근거" };

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const actor = await pageActor();
  const ix = await loadIndex(await getStore());
  const filter: DashFilter = {
    kind: searchParams.kind === "개발" || searchParams.kind === "운영" ? searchParams.kind : "",
    prjId: searchParams.prj ?? "",
    includeIng: searchParams.ing === "1",
  };
  const prjNm = ix.data.projects.find((p) => p.prjId === filter.prjId)?.prjNm;
  const scope = [actor.role === "DEVELOPER" ? "내 담당 요구사항" : "전체 요구사항", filter.kind && `${filter.kind} 과제`, prjNm, filter.includeIng ? "측정 완료 + 측정 중" : "측정 완료"].filter(Boolean).join(" · ");
  return <BasisView vm={basisView(ix, actor, filter)} scope={scope} />;
}
