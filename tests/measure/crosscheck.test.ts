import { describe, it, expect } from "vitest";
import { runChecks } from "@/lib/measure/crosscheck";
import { sampleMeasureInput } from "@/lib/measure/sampleData";

describe("runChecks", () => {
  it("seed 는 교차 검증 위반이 없다(사후 수정 커밋은 제외)", () => {
    const r = runChecks(sampleMeasureInput(), "2026-10-20");
    expect(r.cross).toEqual([]);
  });

  it("허용 오차 1일 — 하루 밖은 통과, 이틀 밖은 위반", () => {
    const input = sampleMeasureInput();
    input.commits.push({ prjId: "PRJ-0001", hash: "x1", workDt: "2026-10-05", author: "k", message: "[WBS-3.2.1] a", wbsId: "WBS-3.2.1", added: 1, deleted: 0 });
    expect(runChecks(input, "2026-10-20").cross).toEqual([]);
    input.commits.push({ prjId: "PRJ-0001", hash: "x2", workDt: "2026-10-04", author: "k", message: "[WBS-3.2.1] b", wbsId: "WBS-3.2.1", added: 1, deleted: 0 });
    const r = runChecks(input, "2026-10-20");
    expect(r.cross).toHaveLength(1);
    expect(r.cross[0]).toMatchObject({ wbsId: "WBS-3.2.1", kind: "COMMIT_OUTSIDE", dates: ["2026-10-04"] });
  });

  it("AI 사용일이 공수 기간 밖이면 위반", () => {
    const input = sampleMeasureInput();
    input.usages.push({ ...input.usages[0], workDt: "2026-10-01" });
    expect(runChecks(input, "2026-10-20").cross.map((c) => c.kind)).toEqual(["AI_OUTSIDE"]);
  });

  it("공수는 있는데 커밋·AI 기록이 없으면 NO_TRACE", () => {
    const input = sampleMeasureInput();
    input.commits = input.commits.filter((c) => c.wbsId !== "WBS-4.1.3");
    input.usages = input.usages.filter((u) => u.wbsId !== "WBS-4.1.3");
    expect(runChecks(input, "2026-10-20").cross).toEqual([expect.objectContaining({ wbsId: "WBS-4.1.3", kind: "NO_TRACE" })]);
  });

  it("진행 중인데 3일 이상 공수 기록이 없으면 미입력", () => {
    const input = sampleMeasureInput();
    const f = input.features.find((x) => x.wbsId === "WBS-3.4.2")!;
    f.status = "DOING";
    f.completedAt = null;
    expect(runChecks(input, "2026-10-16").idle).toEqual([]);
    expect(runChecks(input, "2026-10-17").idle).toEqual([expect.objectContaining({ wbsId: "WBS-3.4.2", idleDays: 3, lastWorkDt: "2026-10-14" })]);
  });

  it("커밋 규칙 위반 비율", () => {
    const r = runChecks(sampleMeasureInput(), "2026-10-20");
    expect(r.commitViolation).toEqual({ total: 7, violations: 1, rate: 1 / 7 });
  });

  it("WBS 미상 사용량·단가 미설정 모델", () => {
    const input = sampleMeasureInput();
    input.usages.push({ ...input.usages[0], wbsId: null, model: "mystery" });
    const r = runChecks(input, "2026-10-20");
    expect(r.unknownWbsUsage).toBe(1);
    expect(r.unpricedModels).toEqual(["mystery"]);
  });
});
