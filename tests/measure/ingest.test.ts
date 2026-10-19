import { it, expect } from "vitest";
import { activeMinutes, kstDate, parseLogUpload, parseOtelLogs } from "@/lib/measure/ingest";

const kv = (key: string, v: string) => ({ key, value: { stringValue: v } });
// 2026-11-10 23:30 UTC = 11-11 08:30 KST
const T0 = Date.UTC(2026, 10, 10, 23, 30);
const nano = (ms: number) => String(ms * 1e6);

it("KST 일자 경계", () => {
  expect(kstDate(Date.UTC(2026, 10, 10, 15, 0))).toBe("2026-11-11");
  expect(kstDate(Date.UTC(2026, 10, 10, 14, 59))).toBe("2026-11-10");
});

it("활동 시간 = 5분 이하 간격만 더하고, 앞 묶음 마지막 시각에서 이어 센다", () => {
  const m = 60000;
  expect(activeMinutes([0, 4 * m, 6 * m, 66 * m])).toBe(4 + 2 + 5);
  expect(activeMinutes([10 * m, 12 * m], 8 * m)).toBe(4);
  expect(activeMinutes([3 * m], 8 * m)).toBe(0);
});

it("Codex 이벤트 → 계정 후보·대화 ID·토큰, 프롬프트는 태그 후보만 남기고 버린다", () => {
  const common = [kv("conversation.id", "cv1"), kv("user.email", "dev02@corp.com"), kv("user.account_id", "acc-9"), kv("model", "gpt-5-codex")];
  const body = {
    resourceLogs: [
      {
        resource: { attributes: [kv("service.name", "codex_cli_rs")] },
        scopeLogs: [
          {
            logRecords: [
              { timeUnixNano: nano(T0), attributes: [kv("event.name", "codex.user_prompt"), ...common, kv("prompt", "DAE01-REQ0051-DS 화면 설계 해줘 비밀내용")] },
              {
                timeUnixNano: nano(T0 + 60000),
                attributes: [kv("event.name", "codex.sse_event"), ...common, kv("event.kind", "response.completed"), kv("input_token_count", "1200"), kv("cached_token_count", "200"), kv("output_token_count", "300")],
              },
              { timeUnixNano: nano(T0 + 90000), attributes: [kv("event.name", "codex.sse_event"), ...common, kv("event.kind", "response.output_text.delta")] },
              { timeUnixNano: nano(T0), attributes: [kv("event.name", "other"), ...common] },
            ],
          },
        ],
      },
    ],
  };
  const out = parseOtelLogs(body);
  expect(out).toHaveLength(3);
  expect(out[0]).toMatchObject({ accounts: ["dev02@corp.com", "acc-9"], sessionId: "cv1", tool: "Codex", workDt: "2026-11-11", tokens: null });
  expect(out[0].hints).toContain("DAE01-REQ0051-DS");
  expect(out[1]).toMatchObject({ model: "gpt-5-codex", tokens: { input: 1200, cached: 200, output: 300 } });
  expect(out[2].tokens).toBeNull();
  expect(JSON.stringify(out)).not.toContain("비밀");
});

it("업로드 JSON 형식 검사 · 토큰", () => {
  expect(parseLogUpload({ sessions: [] })).toHaveProperty("error");
  const r = parseLogUpload({
    format: "poc-ai-sessions",
    sessions: [
      { sessionId: "a", date: "2026-11-10", activeMin: 12.4, tool: "Codex", tokens: { "gpt-5-codex": { input: 10, cached: 2, output: 5 }, bad: "x" } },
      { date: "x" },
      { sessionId: "b", date: "2026-11-10", activeMin: 0 },
    ],
  });
  expect("sessions" in r && r.sessions).toHaveLength(1);
  expect("sessions" in r && r.sessions[0].tokens).toEqual({ "gpt-5-codex": { input: 10, cached: 2, output: 5 } });
  expect("warnings" in r && r.warnings).toHaveLength(1);
});
