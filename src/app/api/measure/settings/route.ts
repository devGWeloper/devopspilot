import { ok } from "@/lib/api";
import { getSettings } from "@/lib/measure/repo";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

// 일반 화면용 — 단가 등 관리자 설정 중 화면 표시에 필요한 값만 내린다.
export const GET = route(async ({ store }) => {
  const s = await getSettings(store);
  return ok({ featureTypes: s.featureTypes, phases: s.phases, postFixDays: s.postFixDays, mdHours: s.mdHours, wbsPattern: s.wbsPattern, jiraMappings: s.jiraMappings });
});
