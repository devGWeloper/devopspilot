import type { Phase } from "./types";

// 자연키를 DAT_ID 로 쓰므로 같은 원천을 다시 올리면 행이 늘지 않고 덮어써진다.
export const datId = {
  feature: (prjId: string, wbsId: string) => `FEAT:${prjId}:${wbsId}`,
  effort: (prjId: string, wbsId: string, date: string, phase: Phase, userId: string) => `EFF:${prjId}:${wbsId}:${date}:${phase}:${userId}`,
  defect: (prjId: string, defectId: string) => `DEF:${prjId}:${defectId}`,
  aiuse: (prjId: string, date: string, userId: string, wbsId: string | null, model: string, src: string) =>
    `USE:${prjId}:${date}:${userId}:${wbsId ?? "-"}:${model}:${src}`,
  commit: (prjId: string, hash: string) => `CMT:${prjId}:${hash}`,
};
