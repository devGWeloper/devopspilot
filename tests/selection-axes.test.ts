import { describe, it, expect } from "vitest";
import { LEVEL_AXES, levelAvg, stageSums } from "@/features/selection/axes";
import type { SelReqVM } from "@/lib/views";

const row = (stage: SelReqVM["stage"], baseMd: number, values: Record<string, string>): SelReqVM => ({
  prjId: "P1",
  reqId: `P1-R-${stage}`,
  name: "R",
  stage,
  baseMd,
  status: "WAIT",
  values,
});

describe("선정 과제 분포", () => {
  it("상·중·하 축만 분포도 축이 된다", () => {
    expect(LEVEL_AXES).toEqual(expect.arrayContaining(["FIT-06", "REQ-04", "FIT-01", "FIT-02", "FIT-03"]));
    expect(LEVEL_AXES).not.toContain("REQ-05");
  });

  it("평균은 상·중·하 값만 센다", () => {
    const rs = [row("AN", 1, { "FIT-06": "상" }), row("DV", 2, { "FIT-06": "하" }), row("TS", 1, { "FIT-06": "" })];
    expect(levelAvg(rs, "FIT-06")).toBe(2);
    expect(levelAvg(rs, "REQ-04")).toBeNull();
  });

  it("단계별 합계는 네 단계 자리를 모두 둔다", () => {
    const rs = [row("DV", 3, {}), row("DV", 2, {}), row("TS", 1, {})];
    const by = Object.fromEntries(stageSums(rs).map((x) => [x.cd, x]));
    expect(Object.keys(by)).toEqual(["AN", "DS", "DV", "TS"]);
    expect(by.DV).toMatchObject({ label: "개발", n: 2, baseMd: 5 });
    expect(by.AN.n).toBe(0);
  });
});
