import { fromResult, readJson } from "@/lib/api";
import { uploadLog } from "@/lib/measure/service";
import { route } from "@/lib/route";

/** 세션 파일은 브라우저에서 요약해 보낸다 — 대화 원문이 서버로 오지 않게 */
export const POST = route(async ({ req, actor, store }) => fromResult(await uploadLog(store, actor, await readJson(req))));
