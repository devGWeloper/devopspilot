import type { MeasureSettings } from "./types";

export const DEFAULT_WBS_PATTERN = "WBS-[0-9]+(?:\\.[0-9]+)*";

export function defaultMeasureSettings(): MeasureSettings {
  return {
    laborRatePerHour: 0,
    tokenPrices: [],
    postFixDays: 14,
    phases: { DESIGN: true, DEV: true, UNIT: true, INTEG: false },
    crossCheckToleranceDays: 1,
    idleAlertDays: 3,
    mdHours: 8,
    sizeBands: { S: 16, M: 40, L: 80 },
    featureTypes: [
      { code: "SCREEN", label: "화면" },
      { code: "IF_BATCH", label: "IF·배치" },
      { code: "MES_LOGIC", label: "MES 도메인 로직" },
      { code: "LEGACY", label: "레거시 수정" },
    ],
    wbsPattern: DEFAULT_WBS_PATTERN,
    jiraMappings: {},
    sampleValues: false,
  };
}
