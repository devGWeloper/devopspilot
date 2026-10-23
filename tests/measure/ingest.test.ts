import { it, expect } from "vitest";
import { activeMinutes, kstDate, parseCodexSessions, parseLogUpload } from "@/lib/measure/ingest";

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

const line = (ts: string, type: string, payload: Record<string, unknown>) => JSON.stringify({ timestamp: ts, type, payload });
const tok = (ts: string, input: number, cached: number, output: number) =>
  line(ts, "event_msg", { type: "token_count", info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: output } } });

// 11-10 23:58 KST 에 시작해 자정을 넘기는 세션 — 14:58Z = 23:58 KST
const rollout = [
  line("2026-11-10T14:58:00.000Z", "session_meta", { id: "sid-1", git: { branch: "feature/dae01-req0047-dv" } }),
  line("2026-11-10T14:58:00.000Z", "turn_context", { model: "gpt-5-codex" }),
  line("2026-11-10T14:58:30.000Z", "event_msg", { type: "user_message", message: "DAE01-REQ0051-DS 화면 설계 해줘 비밀내용" }),
  tok("2026-11-10T14:59:00.000Z", 1000, 100, 50),
  tok("2026-11-10T14:59:00.000Z", 1000, 100, 50),
  tok("2026-11-10T15:02:00.000Z", 1500, 300, 80),
  // 1시간 자리 비움 — 5분까지만 센다
  line("2026-11-10T16:02:00.000Z", "response_item", { type: "message", role: "user", content: [{ type: "input_text", text: "poc off" }] }),
  "깨진 줄",
].join("\n");

it("Codex 세션 파일 → 세션 × 일자, 자리 비움 제외, 토큰 증가분, 원문 없이 태그 후보만", () => {
  const { summary, warnings } = parseCodexSessions([{ name: "2026/11/10/rollout-2026-11-10T23-58-00-sid-1.jsonl", text: rollout }]);
  expect(summary.format).toBe("poc-ai-sessions");
  expect(summary.sessions.map((x) => [x.date, x.start, x.end, x.activeMin])).toEqual([
    ["2026-11-10", "23:58", "23:59", 1],
    ["2026-11-11", "00:02", "01:02", 5],
  ]);
  const [d1, d2] = summary.sessions;
  expect(d1).toMatchObject({ sessionId: "sid-1", branch: "feature/dae01-req0047-dv", tokens: { "gpt-5-codex": { input: 1000, cached: 100, output: 50 } } });
  expect(d2.tokens).toEqual({ "gpt-5-codex": { input: 500, cached: 200, output: 30 } });
  expect(d1.hints).toEqual(expect.arrayContaining(["DAE01-REQ0047-DV", "DAE01-REQ0051-DS", "POC-OFF"]));
  expect(JSON.stringify(summary)).not.toContain("비밀");
  expect(warnings).toEqual(["rollout-2026-11-10T23-58-00-sid-1.jsonl: 1줄 해석 실패 — 건너뜀"]);
  // 서버 검사를 그대로 통과한다
  const r = parseLogUpload(summary);
  expect("sessions" in r && r.sessions.map((x) => x.minutes)).toEqual([1, 5]);
});

it("측정 시작일 전 날짜는 빼고, 같은 세션이 두 파일에 있어도 한 번만 센다 · 세션 기록이 아니면 경고", () => {
  const { summary, warnings } = parseCodexSessions(
    [
      { name: "rollout-a.jsonl", text: rollout },
      { name: "rollout-b.jsonl", text: rollout },
      { name: "notes.jsonl", text: "hello" },
    ],
    "2026-11-11",
  );
  expect(summary.sessions).toHaveLength(1);
  expect(summary.sessions[0]).toMatchObject({ date: "2026-11-11", activeMin: 5, tokens: { "gpt-5-codex": { input: 500, cached: 200, output: 30 } } });
  expect(warnings).toContain("notes.jsonl: Codex 세션 기록이 아닙니다 — 건너뜀");
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
