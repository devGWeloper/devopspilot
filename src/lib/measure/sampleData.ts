import { defaultMeasureSettings } from "./defaults";
import type { AiUse, Commit, Defect, Effort, Feature, MeasureInput, Phase } from "./types";

// replay.md 9절 seed. 단위 테스트 기대값(60% / 39% / 17%)과 데모 데이터가 같은 원천을 쓰도록 한 곳에 둔다.
const PRJ = "PRJ-0001";

function feature(wbsId: string, name: string, typeCd: string, a: [number, number, number], defects: number, completedAt: string, devUserId = "dev01"): Feature {
  return {
    prjId: PRJ,
    wbsId,
    name,
    typeCd,
    devUserId,
    devUserNm: devUserId === "dev01" ? "최민준" : "정다은",
    status: "DONE",
    completedAt,
    baseline: { DESIGN: a[0], DEV: a[1], UNIT: a[2], INTEG: 0, defects, evidence: "WBS 실적표(2025) 기준", evidenceVerified: wbsId !== "WBS-4.1.3" },
    note: "",
  };
}

function efforts(wbsId: string, plan: [string, Phase, number][], userId = "dev01"): Effort[] {
  return plan.map(([workDt, phase, hours]) => ({ prjId: PRJ, wbsId, workDt, phase, hours, userId, aiLevel: phase === "DEV" ? "LEAD" : "PARTIAL", memo: "", srcCd: "MANUAL" }));
}

function commit(hash: string, workDt: string, message: string, added: number, deleted: number, wbsId: string | null): Commit {
  return { prjId: PRJ, hash, workDt, author: "choi.minjun", message, wbsId, added, deleted };
}

function usage(wbsId: string, workDt: string, requests: number, input: number, output: number, cacheRead: number, cacheWrite: number, model = "claude-sonnet-4-5"): AiUse {
  return {
    prjId: PRJ,
    wbsId,
    workDt,
    userId: "dev01",
    model,
    requests,
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    reportedCost: null,
    srcCd: "LOCAL_LOG",
  };
}

export function sampleMeasureInput(): MeasureInput {
  const settings = defaultMeasureSettings();
  settings.laborRatePerHour = 60_000;
  settings.tokenPrices = [
    { model: "claude-sonnet-4-5", input: 4_500, output: 22_500, cacheRead: 450, cacheWrite: 5_600 },
    { model: "gpt-5-codex", input: 1_800, output: 14_000, cacheRead: 180, cacheWrite: 0 },
  ];
  settings.sampleValues = true;

  const defect = (wbsId: string, defectId: string, foundDt: string, severity: Defect["severity"], title: string): Defect => ({
    prjId: PRJ,
    wbsId,
    defectId,
    foundDt,
    phase: "UNIT",
    cause: "요구사항 해석 차이",
    severity,
    title,
    testCaseRef: "TC-" + defectId.slice(-3),
    srcCd: "MANUAL",
  });

  return {
    settings,
    features: [
      feature("WBS-3.2.1", "설비 이력 조회 화면", "SCREEN", [8, 24, 8], 2, "2026-10-10"),
      feature("WBS-3.4.2", "Lot 이동 정보 IF", "IF_BATCH", [12, 32, 12], 3, "2026-10-14"),
      feature("WBS-4.1.3", "레거시 정산 로직 수정", "LEGACY", [4, 14, 6], 1, "2026-10-15", "dev02"),
    ],
    efforts: [
      ...efforts("WBS-3.2.1", [
        ["2026-10-06", "DESIGN", 3],
        ["2026-10-07", "DEV", 5],
        ["2026-10-08", "DEV", 4],
        ["2026-10-09", "UNIT", 4],
      ]),
      ...efforts("WBS-3.4.2", [
        ["2026-10-08", "DESIGN", 6],
        ["2026-10-09", "DEV", 6],
        ["2026-10-10", "DEV", 7],
        ["2026-10-13", "DEV", 5],
        ["2026-10-14", "UNIT", 10],
      ]),
      ...efforts(
        "WBS-4.1.3",
        [
          ["2026-10-12", "DESIGN", 4],
          ["2026-10-13", "DEV", 6],
          ["2026-10-14", "DEV", 4],
          ["2026-10-15", "UNIT", 6],
        ],
        "dev02",
      ),
    ],
    defects: [
      defect("WBS-3.2.1", "QA-101", "2026-10-09", "NORMAL", "조회 기간 경계값 누락"),
      defect("WBS-3.4.2", "QA-102", "2026-10-14", "CRITICAL", "Lot 이동 시각 타임존 오류"),
      defect("WBS-3.4.2", "QA-103", "2026-10-14", "NORMAL", "재전송 시 중복 레코드"),
    ],
    commits: [
      commit("a1b2c3d", "2026-10-07", "[WBS-3.2.1] 설비 이력 조회 화면 추가", 320, 10, "WBS-3.2.1"),
      commit("b2c3d4e", "2026-10-09", "[WBS-3.2.1] 단위 테스트 보강", 80, 20, "WBS-3.2.1"),
      commit("c3d4e5f", "2026-10-22", "[WBS-3.2.1] 조회 오류 수정", 12, 6, "WBS-3.2.1"),
      commit("d4e5f6a", "2026-10-10", "[WBS-3.4.2] Lot 이동 정보 IF 구현", 450, 0, "WBS-3.4.2"),
      commit("e5f6a7b", "2026-10-13", "[WBS-3.4.2] 재전송 로직 정리", 60, 15, "WBS-3.4.2"),
      commit("f6a7b8c", "2026-10-14", "[WBS-4.1.3] 정산 로직 수정", 40, 35, "WBS-4.1.3"),
      commit("0a1b2c3", "2026-10-11", "README 정리", 5, 1, null),
    ],
    usages: [
      usage("WBS-3.2.1", "2026-10-07", 42, 180_000, 64_000, 1_200_000, 90_000),
      usage("WBS-3.2.1", "2026-10-08", 35, 150_000, 51_000, 980_000, 70_000),
      usage("WBS-3.4.2", "2026-10-09", 51, 230_000, 82_000, 1_500_000, 120_000),
      usage("WBS-3.4.2", "2026-10-10", 47, 210_000, 77_000, 1_350_000, 100_000),
      { ...usage("WBS-4.1.3", "2026-10-13", 28, 140_000, 40_000, 600_000, 0, "gpt-5-codex"), userId: "dev02" },
    ],
  };
}
