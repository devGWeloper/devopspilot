import type { ProfileCell } from "@/lib/fitness";
import s from "./ui.module.css";

// 지표 칸마다 상·중·하를 칠하면 과제 적합도(행당 하나)와 혼동되므로, 칸은 입력 여부만 보이고 값은 툴팁으로 보인다.
export function ProfileStrip({ profile, size = "md" }: { profile: ProfileCell[]; size?: "sm" | "md" | "lg" }) {
  const groups: ProfileCell[][] = [];
  for (const c of profile) {
    const last = groups[groups.length - 1];
    if (last && last[0].areaId === c.areaId) last.push(c);
    else groups.push([c]);
  }
  const filled = profile.filter((p) => p.optionLabel).length;
  const summary = `지표 ${profile.length}개 중 ${filled}개 입력, 미입력 ${profile.length - filled}개`;
  const sizeCls = size === "sm" ? s.stripSm : size === "lg" ? s.stripLg : s.stripMd;
  return (
    <span className={`${s.strip} ${sizeCls}`} role="img" aria-label={summary} title={size === "sm" ? summary : undefined}>
      {groups.map((g) => (
        <span key={g[0].areaId} className={s.stripGroup}>
          {g.map((c) => (
            <span key={c.indicatorId} className={`${s.cell} ${c.tier === "MAJOR" ? s.cellMajor : s.cellMinor}`} data-filled={c.optionLabel ? "true" : undefined}>
              {size !== "sm" && (
                <span className={s.tip}>
                  {c.tier === "MAJOR" ? "★ " : ""}
                  {c.indicatorName} · {c.optionLabel ?? "미입력"}
                </span>
              )}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}
