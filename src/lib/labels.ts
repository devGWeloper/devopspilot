import type { AgreeCd, Fit, OrgCd, ProjectStatus } from "./types";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: "작성중",
  SUBMITTED: "제출",
  REVIEW: "검토중",
  SUPPLEMENT: "보완요청",
  SELECTED: "선정",
  RESERVE: "예비",
  EXCLUDED: "제외",
};

export const STATUS_TONE: Record<ProjectStatus, "neutral" | "accent" | "ok" | "warn" | "danger" | "info"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  REVIEW: "accent",
  SUPPLEMENT: "warn",
  SELECTED: "ok",
  RESERVE: "info",
  EXCLUDED: "danger",
};

export const AGREE_LABEL: Record<AgreeCd, string> = { AGREE: "동의", DISAGREE: "이견", HOLD: "보류", NONE: "미응답" };

export const ORG_LABEL: Record<OrgCd, string> = { SKAX: "SK AX", SKHYNIX: "SK hynix" };

export const FIT_COLOR: Record<Fit, string> = {
  H: "var(--fit-h)",
  M: "var(--fit-m)",
  L: "var(--fit-l)",
  NA: "var(--fit-na)",
};

export const FIT_SOFT: Record<Fit, string> = {
  H: "var(--fit-h-soft)",
  M: "var(--fit-m-soft)",
  L: "var(--fit-l-soft)",
  NA: "var(--fit-na-soft)",
};

export { FIT_LABEL } from "./fitness";

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fmtRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const sec = Math.round((now - t) / 1000);
  if (sec < 60) return "방금";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}일 전`;
  return fmtDate(iso);
}
