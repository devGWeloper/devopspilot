import { fail, fromResult, ok, readJson } from "@/lib/api";
import { kstDate, normDate } from "@/lib/measure/csv";
import { loadInput } from "@/lib/measure/repo";
import { saveTodayEfforts, type TodayItem } from "@/lib/measure/service";
import { route } from "@/lib/route";

export const dynamic = "force-dynamic";

// 개발자 첫 화면. 한 번의 요청으로 담당 기능·그 날짜 기록·누적값을 다 내려 1분 안에 입력이 끝나게 한다.
export const GET = route(async ({ req, actor, store }) => {
  const date = normDate(new URL(req.url).searchParams.get("date") ?? "") ?? kstDate(Date.now());
  const selected = (await store.projects.list()).filter((p) => p.status === "SELECTED");
  const input = await loadInput(store, selected.map((p) => p.prjId));
  const mine = input.features.filter((f) => (actor.role === "AX_ADMIN" ? true : f.devUserId === actor.userId));
  const items = mine.map((f) => {
    const effs = input.efforts.filter((e) => e.prjId === f.prjId && e.wbsId === f.wbsId);
    const phases = Object.keys(input.settings.phases).filter((k) => input.settings.phases[k as keyof typeof input.settings.phases]);
    return {
      feature: f,
      prjNm: selected.find((p) => p.prjId === f.prjId)?.prjNm ?? f.prjId,
      a: phases.reduce((s, ph) => s + (f.baseline[ph as keyof typeof f.baseline] as number), 0),
      b: effs.filter((e) => input.settings.phases[e.phase]).reduce((s, e) => s + e.hours, 0),
      today: effs.filter((e) => e.workDt === date && e.userId === actor.userId && e.srcCd === "MANUAL"),
      lastWorkDt: effs.map((e) => e.workDt).sort().pop() ?? null,
    };
  });
  return ok({ date, phases: input.settings.phases, items });
});

export const POST = route(async ({ req, actor, store }) => {
  const body = await readJson<{ date: string; items: TodayItem[]; completes?: { prjId: string; wbsId: string }[] }>(req);
  if (!body || !Array.isArray(body.items)) return fail(400, "BAD_REQUEST", "요청 형식이 올바르지 않습니다.");
  return fromResult(await saveTodayEfforts(store, actor, body.date, body.items, body.completes ?? []));
});
