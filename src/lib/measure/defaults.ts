import { STAGES } from "../types";
import type { Settings } from "./types";

export const SETTINGS_KEY = "SETTINGS";

export function defaultSettings(): Settings {
  return {
    mdHours: 8,
    gradePrice: { 특급: 750000, 고급: 620000, 중급: 480000, 초급: 360000 },
    gradePriceMm: { 특급: 0, 고급: 0, 중급: 0, 초급: 0 },
    // 계약 단가가 정해지기 전이라 비워 둔다 — 비어 있으면 AI 비용은 빈칸으로 보인다.
    tokenPrice: {},
    measureStart: "2026-11-02",
    workTypes: {
      AN: ["요구사항 분석·정의"],
      DS: ["UI 설계", "프로그램 설계", "DB 설계", "인터페이스 설계"],
      DV: ["UI 개발", "백엔드 로직 신규", "백엔드 로직 수정", "인터페이스·연계", "DB·SQL", "배치", "코드·플랫폼 전환", "성능 개선"],
      TS: ["단위 테스트", "통합·회귀 테스트"],
    },
  };
}

/** 저장된 설정에 빠진 키가 있어도(이전 버전) 화면이 깨지지 않게 기본값으로 채운다. */
export function normalizeSettings(v: Partial<Settings> | null | undefined): Settings {
  const d = defaultSettings();
  if (!v) return d;
  return {
    mdHours: v.mdHours && v.mdHours > 0 ? v.mdHours : d.mdHours,
    gradePrice: { ...d.gradePrice, ...(v.gradePrice ?? {}) },
    gradePriceMm: { ...d.gradePriceMm, ...(v.gradePriceMm ?? {}) },
    tokenPrice: v.tokenPrice ?? d.tokenPrice,
    measureStart: v.measureStart || d.measureStart,
    // 저장값에 남은 배포·운영 단계 키는 버린다.
    workTypes: Object.fromEntries(STAGES.map((c) => [c, v.workTypes?.[c] ?? d.workTypes[c]])) as Settings["workTypes"],
  };
}
