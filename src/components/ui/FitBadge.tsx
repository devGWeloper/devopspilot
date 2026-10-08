import { FIT_COLOR, FIT_LABEL, FIT_SOFT } from "@/lib/labels";
import type { Fit } from "@/lib/types";
import s from "./ui.module.css";

// 확정과 제안을 색이 아닌 테두리 모양(실선/점선)으로도 구분해 흑백 인쇄에서도 읽히게 한다.
export function FitBadge({
  fit,
  confirmed = true,
  size = "md",
}: {
  fit: Fit;
  confirmed?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const suggest = !confirmed && fit !== "NA";
  const style = {
    color: FIT_COLOR[fit],
    background: FIT_SOFT[fit],
    borderColor: suggest ? FIT_COLOR[fit] : "transparent",
  };
  const title = fit === "NA" ? "미평가" : `${confirmed ? "확정" : "제안"} 적합도 ${FIT_LABEL[fit]}`;
  const cls = [s.fit, size === "sm" ? s.fitSm : size === "lg" ? s.fitLg : s.fitMd, suggest ? s.fitSuggest : ""].join(" ");
  return (
    <span className={cls} style={style} title={title} aria-label={title}>
      {fit === "NA" ? (size === "lg" ? "—" : "미평가") : FIT_LABEL[fit]}
      {size === "lg" && <span className={s.fitLgCaption}>{fit === "NA" ? "미평가" : confirmed ? "확정" : "제안"}</span>}
    </span>
  );
}

export function FitPair({ finalFit, suggestFit, size = "md" }: { finalFit: Fit; suggestFit: Fit; size?: "sm" | "md" | "lg" }) {
  return finalFit !== "NA" ? <FitBadge fit={finalFit} size={size} /> : <FitBadge fit={suggestFit} confirmed={false} size={size} />;
}
