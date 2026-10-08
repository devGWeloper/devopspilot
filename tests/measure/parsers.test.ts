import { describe, it, expect } from "vitest";
import { extractWbs, parseCsv, toCsv } from "@/lib/measure/csv";
import { parseAiUsageCsv } from "@/lib/measure/parsers/aiusageCsv";
import { parseCommitsCsv } from "@/lib/measure/parsers/commitsCsv";
import { jiraHeaders, parseJiraCsv } from "@/lib/measure/parsers/jiraCsv";
import { parseOtel } from "@/lib/measure/parsers/otel";
import { DEFAULT_WBS_PATTERN } from "@/lib/measure/defaults";

const ctx = { prjId: "PRJ-0001", wbsPattern: DEFAULT_WBS_PATTERN };

describe("csv", () => {
  it("따옴표·쉼표·줄바꿈·BOM·CRLF", () => {
    const text = '﻿a,b,c\r\n1,"x, y","line1\nline2"\r\n2,"he said ""hi""",\r\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b", "c"],
      ["1", "x, y", "line1\nline2"],
      ["2", 'he said "hi"', ""],
    ]);
  });

  it("toCsv 왕복", () => {
    const rows = [["a", 'q"t', "x,y"], [1, null, "z"]];
    expect(parseCsv(toCsv(rows))).toEqual([["a", 'q"t', "x,y"], ["1", "", "z"]]);
  });

  it("WBS 추출", () => {
    expect(extractWbs("poc/WBS-3.2.1-screen", DEFAULT_WBS_PATTERN)).toBe("WBS-3.2.1");
    expect(extractWbs("[WBS-12] fix", DEFAULT_WBS_PATTERN)).toBe("WBS-12");
    expect(extractWbs("no id here", DEFAULT_WBS_PATTERN)).toBeNull();
    expect(extractWbs(null, DEFAULT_WBS_PATTERN)).toBeNull();
  });
});

describe("AI 사용량 CSV (수집 스크립트 출력)", () => {
  const head = "date,user,wbs_id,model,requests,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,source";
  it("정상 행과 숫자 오류 행", () => {
    const r = parseAiUsageCsv(
      [head, "2026-10-07,dev01,WBS-3.2.1,claude-sonnet-4-5,12,100,200,300,400,claude", "2026-10-07,dev01,,m,abc,1,1,1,1,codex", "2026-10-08,dev01,,m,3,1,1,1,1,codex"].join("\n"),
      ctx,
    );
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ workDt: "2026-10-07", userId: "dev01", wbsId: "WBS-3.2.1", requests: 12, inputTokens: 100, cacheWriteTokens: 400, srcCd: "LOCAL_LOG" });
    expect(r.rows[1].wbsId).toBeNull();
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].line).toBe(3);
  });

  it("같은 키는 합산", () => {
    const r = parseAiUsageCsv([head, "2026-10-07,dev01,WBS-1,m,1,10,0,0,0,claude", "2026-10-07,dev01,WBS-1,m,2,5,0,0,0,claude"].join("\n"), ctx);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ requests: 3, inputTokens: 15 });
  });

  it("필수 열이 없으면 경고만", () => {
    const r = parseAiUsageCsv("foo,bar\n1,2", ctx);
    expect(r.rows).toEqual([]);
    expect(r.warnings[0].message).toContain("열");
  });
});

describe("OTel", () => {
  const ns = (iso: string) => String(BigInt(Date.parse(iso)) * 1_000_000n);
  it("OTLP JSON — 토큰 4종, 요청 수, 비용", () => {
    const attrs = (o: Record<string, string>) => Object.entries(o).map(([key, v]) => ({ key, value: { stringValue: v } }));
    const json = {
      resourceMetrics: [
        {
          resource: { attributes: attrs({ project: "poc", "user.email": "dev01@sk.com", branch: "poc/WBS-3.2.1" }) },
          scopeMetrics: [
            {
              metrics: [
                {
                  name: "claude_code.token.usage",
                  sum: {
                    dataPoints: [
                      { attributes: attrs({ type: "input", model: "claude-sonnet-4-5" }), timeUnixNano: ns("2026-10-07T03:00:00Z"), asInt: "100" },
                      { attributes: attrs({ type: "output", model: "claude-sonnet-4-5" }), timeUnixNano: ns("2026-10-07T03:00:00Z"), asInt: "50" },
                      { attributes: attrs({ type: "cacheRead", model: "claude-sonnet-4-5" }), timeUnixNano: ns("2026-10-07T03:00:00Z"), asDouble: 1000 },
                      { attributes: attrs({ type: "cacheCreation", model: "claude-sonnet-4-5" }), timeUnixNano: ns("2026-10-07T03:00:00Z"), asInt: "70" },
                    ],
                  },
                },
                { name: "claude_code.cost.usage", sum: { dataPoints: [{ attributes: attrs({ model: "claude-sonnet-4-5" }), timeUnixNano: ns("2026-10-07T03:00:00Z"), asDouble: 0.5 }] } },
              ],
            },
          ],
        },
      ],
      resourceLogs: [
        {
          resource: { attributes: attrs({ "user.email": "dev01@sk.com", branch: "poc/WBS-3.2.1" }) },
          scopeLogs: [
            {
              logRecords: [
                { timeUnixNano: ns("2026-10-07T03:00:00Z"), body: { stringValue: "claude_code.api_request" }, attributes: attrs({ "event.name": "api_request", model: "claude-sonnet-4-5" }) },
                { timeUnixNano: ns("2026-10-07T04:00:00Z"), body: { stringValue: "claude_code.api_request" }, attributes: attrs({ "event.name": "api_request", model: "claude-sonnet-4-5" }) },
                { timeUnixNano: ns("2026-10-07T04:00:00Z"), body: { stringValue: "claude_code.user_prompt" }, attributes: attrs({ "event.name": "user_prompt" }) },
              ],
            },
          ],
        },
      ],
    };
    const r = parseOtel(JSON.stringify(json), { ...ctx, fileName: "otel.json" });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      workDt: "2026-10-07",
      userId: "dev01",
      wbsId: "WBS-3.2.1",
      model: "claude-sonnet-4-5",
      requests: 2,
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 1000,
      cacheWriteTokens: 70,
      reportedCost: 0.5,
      srcCd: "OTEL",
    });
  });

  it("CSV 형식", () => {
    const csv = [
      "timestamp,metric,type,model,value,user,project,branch",
      "2026-10-08T01:00:00Z,claude_code.token.usage,input,m1,10,dev02,poc,feat/WBS-4.1.3",
      "2026-10-08T01:00:00Z,claude_code.token.usage,output,m1,4,dev02,poc,feat/WBS-4.1.3",
      "2026-10-08T01:00:00Z,claude_code.api_request,,m1,1,dev02,poc,feat/WBS-4.1.3",
      "bad-date,claude_code.token.usage,input,m1,1,dev02,poc,",
    ].join("\n");
    const r = parseOtel(csv, { ...ctx, fileName: "otel.csv" });
    expect(r.rows[0]).toMatchObject({ userId: "dev02", wbsId: "WBS-4.1.3", inputTokens: 10, outputTokens: 4, requests: 1 });
    expect(r.warnings).toHaveLength(1);
  });

  it("깨진 JSON 은 경고", () => {
    expect(parseOtel("{oops", { ...ctx, fileName: "x.json" }).warnings).toHaveLength(1);
  });
});

describe("커밋", () => {
  it("스크립트 CSV", () => {
    const r = parseCommitsCsv(
      ["hash,date,author,message,added,deleted", 'a1,2026-10-07,kim,"[WBS-3.2.1] 화면, 추가",10,2', "b2,2026-10-08,kim,README,1,0", "c3,bad,kim,x,1,1"].join("\n"),
      ctx,
    );
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ hash: "a1", wbsId: "WBS-3.2.1", added: 10, deleted: 2, message: "[WBS-3.2.1] 화면, 추가" });
    expect(r.rows[1].wbsId).toBeNull();
    expect(r.warnings).toHaveLength(1);
  });

  it("git log 원문 (numstat, 바이너리, 제목에 | 포함)", () => {
    const raw = ["@a1|2026-10-07|kim|[WBS-1] a | b", "10\t2\tsrc/a.ts", "-\t-\timg.png", "", "@b2|2026-10-08|lee|fix", "3\t0\tx.ts", ""].join("\n");
    const r = parseCommitsCsv(raw, ctx);
    expect(r.rows).toEqual([
      expect.objectContaining({ hash: "a1", message: "[WBS-1] a | b", added: 10, deleted: 2, wbsId: "WBS-1" }),
      expect.objectContaining({ hash: "b2", author: "lee", added: 3, deleted: 0, wbsId: null }),
    ]);
  });
});

describe("Jira", () => {
  const csv = ["Issue key,Summary,Created,Priority,WBS", 'QA-1,"[WBS-3.2.1] 조회 오류",2026/10/09 10:00,Highest,', "QA-2,정렬 오류,2026-10-10,Medium,WBS-3.4.2", "QA-3,무관,2026-10-10,Low,"].join("\n");
  const mapping = {
    idCol: "Issue key",
    createdCol: "Created",
    summaryCol: "Summary",
    wbsCol: "WBS",
    priorityCol: "Priority",
    priorityMap: { Highest: "CRITICAL" as const, High: "CRITICAL" as const },
    phaseCol: null,
    causeCol: null,
  };
  it("헤더 읽기", () => {
    expect(jiraHeaders(csv)).toEqual(["Issue key", "Summary", "Created", "Priority", "WBS"]);
  });
  it("매핑 — WBS 열이 비면 Summary 에서 추출, 우선순위 매핑, 날짜 정규화, WBS 없으면 경고", () => {
    const r = parseJiraCsv(csv, { ...ctx, mapping });
    expect(r.rows).toEqual([
      expect.objectContaining({ defectId: "QA-1", wbsId: "WBS-3.2.1", severity: "CRITICAL", foundDt: "2026-10-09", srcCd: "JIRA" }),
      expect.objectContaining({ defectId: "QA-2", wbsId: "WBS-3.4.2", severity: "NORMAL", foundDt: "2026-10-10" }),
    ]);
    expect(r.warnings).toHaveLength(1);
  });
});
