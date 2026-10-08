import type { AiResult, Level } from "../types";

export type ParsedAssess = Omit<AiResult, "model" | "promptVersion" | "criteriaVersion" | "assessedAt" | "assessedBy">;

const GRADE: Record<string, Level> = { 상: "H", 중: "M", 하: "L", H: "H", M: "M", L: "L" };
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// 사내 모델이 structured output 을 지원하지 않을 수 있어 자유 텍스트에서 JSON 을 꺼내 검증한다.
export function parseAssessResponse(text: string): { ok: true; value: ParsedAssess } | { ok: false; error: string } {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1];
  const raw = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "모델 응답에서 JSON 을 읽을 수 없습니다." };
  }
  const grade = GRADE[String(o.grade ?? "").trim()];
  if (!grade) return { ok: false, error: `등급 값이 올바르지 않습니다: ${String(o.grade)}` };
  if (typeof o.summary !== "string" || !o.summary.trim()) return { ok: false, error: "요약(summary)이 없습니다." };
  const comments = Array.isArray(o.indicatorComments)
    ? (o.indicatorComments as Record<string, unknown>[]).filter((x) => x && typeof x.indicatorId === "string" && typeof x.comment === "string").map((x) => ({ indicatorId: String(x.indicatorId), comment: String(x.comment) }))
    : [];
  return {
    ok: true,
    value: {
      grade,
      summary: o.summary.trim(),
      strengths: strs(o.strengths),
      risks: strs(o.risks),
      indicatorComments: comments,
      replayNotes: typeof o.replayNotes === "string" ? o.replayNotes : "",
      balanceNote: typeof o.balanceNote === "string" ? o.balanceNote : "",
    },
  };
}
