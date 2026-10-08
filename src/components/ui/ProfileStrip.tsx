import type { ProfileCell } from "@/lib/fitness";
import { FIT_LABEL } from "@/lib/labels";
import s from "./ui.module.css";

export function ProfileStrip({ profile, size = "md" }: { profile: ProfileCell[]; size?: "sm" | "md" | "lg" }) {
  const groups: ProfileCell[][] = [];
  for (const c of profile) {
    const last = groups[groups.length - 1];
    if (last && last[0].areaId === c.areaId) last.push(c);
    else groups.push([c]);
  }
  const answered = profile.filter((p) => p.level);
  const summary = `지표 ${profile.length}개 중 상 ${answered.filter((p) => p.level === "H").length}, 중 ${
    answered.filter((p) => p.level === "M").length
  }, 하 ${answered.filter((p) => p.level === "L").length}, 미응답 ${profile.length - answered.length}`;
  const sizeCls = size === "sm" ? s.stripSm : size === "lg" ? s.stripLg : s.stripMd;
  return (
    <span className={`${s.strip} ${sizeCls}`} role="img" aria-label={summary}>
      {groups.map((g) => (
        <span key={g[0].areaId} className={s.stripGroup}>
          {g.map((c) => (
            <span
              key={c.indicatorId}
              className={`${s.cell} ${c.tier === "MAJOR" ? s.cellMajor : s.cellMinor}`}
              data-level={c.level ?? "none"}
            >
              {size !== "sm" && (
                <span className={s.tip}>
                  {c.tier === "MAJOR" ? "★ " : ""}
                  {c.indicatorName} · {c.optionLabel ? `${c.optionLabel} (${FIT_LABEL[c.level!]})` : "미응답"}
                </span>
              )}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
