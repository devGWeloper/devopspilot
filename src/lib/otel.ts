import { NextResponse } from "next/server";
import { fail, handle } from "./api";
import { loadConfig } from "./config";
import { type OtelDelta } from "./measure/ingest";
import { ingestOtel } from "./measure/service";
import { getStore } from "./store";

/**
 * OTLP/HTTP JSON 수신. 개발자 PC 의 AI 도구가 직접 보내므로 로그인 세션이 없고, 설정 토큰으로만 확인한다.
 * 응답은 OTLP 규격대로 빈 JSON — 실패를 길게 설명해도 보내는 쪽이 읽지 않는다.
 */
export function otelHandler(parse: (body: unknown) => OtelDelta[]) {
  return handle(async (req: Request) => {
    const token = loadConfig().collectToken;
    if (!token) return fail(404, "DISABLED", "텔레메트리 수신이 꺼져 있습니다(config.yml collect.token).");
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${token}`) return fail(401, "UNAUTHENTICATED", "토큰이 맞지 않습니다.");
    if (!(req.headers.get("content-type") ?? "").includes("json"))
      return fail(415, "JSON_ONLY", "OTEL_EXPORTER_OTLP_PROTOCOL=http/json 으로 보내 주세요.");
    const body = await req.json().catch(() => null);
    await ingestOtel(await getStore(), parse(body));
    return NextResponse.json({});
  });
}
