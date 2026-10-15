import { it, expect } from "vitest";
import { kstDate, parseLogUpload, parseOtelLogs, parseOtelMetrics } from "@/lib/measure/ingest";

const kv = (key: string, v: string) => ({ key, value: { stringValue: v } });
// 2026-11-10 23:30 UTC = 11-11 08:30 KST
const NANO = String(Date.UTC(2026, 10, 10, 23, 30) * 1e6);

it("KST 일자 경계", () => {
  expect(kstDate(Date.UTC(2026, 10, 10, 15, 0))).toBe("2026-11-11");
  expect(kstDate(Date.UTC(2026, 10, 10, 14, 59))).toBe("2026-11-10");
});

it("active_time 메트릭 → 세션별 분, poc.user 우선", () => {
  const body = {
    resourceMetrics: [
      {
        resource: { attributes: [kv("service.name", "claude-code"), kv("poc.user", "dev01"), kv("user.email", "x@corp.com"), kv("poc.branch", "feature/REQ-0047-DV")] },
        scopeMetrics: [
          {
            metrics: [
              { name: "claude_code.active_time.total", sum: { dataPoints: [{ asDouble: 600, timeUnixNano: NANO, attributes: [kv("session.id", "abc")] }] } },
              { name: "claude_code.token.usage", sum: { dataPoints: [{ asDouble: 999, timeUnixNano: NANO }] } },
            ],
          },
        ],
      },
    ],
  };
  const out = parseOtelMetrics(body);
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ userId: "dev01", sessionId: "abc", tool: "Claude Code", workDt: "2026-11-11", minutes: 10 });
  expect(out[0].hints).toContain("REQ-0047-DV");
});

it("user_prompt 로그 → 코드만 남기고 원문은 버린다", () => {
  const body = {
    resourceLogs: [
      {
        resource: { attributes: [kv("service.name", "claude-code"), kv("user.email", "dev02@corp.com")] },
        scopeLogs: [
          {
            logRecords: [
              { timeUnixNano: NANO, attributes: [kv("event.name", "user_prompt"), kv("session.id", "s"), kv("prompt", "REQ-0051-DS 화면 설계 해줘 비밀내용")] },
              { timeUnixNano: NANO, attributes: [kv("event.name", "api_request"), kv("session.id", "s")] },
            ],
          },
        ],
      },
    ],
  };
  const out = parseOtelLogs(body);
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ userId: "dev02", minutes: 0 });
  expect(JSON.stringify(out)).not.toContain("비밀");
  expect(out[0].hints).toEqual(["REQ-0051-DS", "REQ-0051"]);
});

it("업로드 JSON 형식 검사", () => {
  expect(parseLogUpload({ sessions: [] })).toHaveProperty("error");
  const r = parseLogUpload({ format: "poc-ai-sessions", sessions: [{ sessionId: "a", date: "2026-11-10", activeMin: 12.4, tool: "Codex" }, { date: "x" }, { sessionId: "b", date: "2026-11-10", activeMin: 0 }] });
  expect("sessions" in r && r.sessions).toHaveLength(1);
  expect("warnings" in r && r.warnings).toHaveLength(1);
});
