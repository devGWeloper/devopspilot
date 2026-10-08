import type { MeasureSettings, Size } from "./types";

const MIN_HOURS = 8;

// 경계값은 아래 구간에 넣지 않고 위 구간에 넣는다(16h → M, 40h → L).
export function classifySize(aHours: number, bands: MeasureSettings["sizeBands"]): { size: Size; outOfRange: boolean } {
  const size: Size = aHours < bands.S ? "S" : aHours < bands.M ? "M" : "L";
  return { size, outOfRange: aHours < MIN_HOURS || aHours > bands.L };
}
