import { parseOtelMetrics } from "@/lib/measure/ingest";
import { otelHandler } from "@/lib/otel";

export const POST = otelHandler(parseOtelMetrics);
