"use client";

import { memo } from "react";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { FORM_GROUPS } from "@/lib/projects/form";
import { AXES, BLANK, type Axis, type AxisDist } from "./axes";
import s from "./selection.module.css";

type Filters = Record<string, string>;

// 선택값 순서(상→하, L0→L4)대로 진하기를 내려서 막대 하나만 봐도 어느 쪽에 몰렸는지 읽힌다.
const rank = (i: number, len: number) => {
  const a = len > 1 ? 0.85 - (i / (len - 1)) * 0.7 : 0.6;
  return { background: `rgba(15, 23, 42, ${a.toFixed(2)})`, color: a > 0.45 ? "#fff" : "var(--ink)" };
};

/** 그룹별 열에 항목마다 막대 하나 — 검색어 입력마다 다시 그리지 않도록 memo. */
export const DistPanel = memo(function DistPanel({ dists, filters, onPick }: { dists: Map<string, AxisDist>; filters: Filters; onPick: (id: string, v: string) => void }) {
  return (
    <Panel flush title="성격별 분포" style={{ marginTop: 20 }}>
      <div className={s.sumGrid}>
        {FORM_GROUPS.map((g) => {
          const axes = AXES.filter((a) => a.group === g.key);
          if (!axes.length) return null;
          const n = dists.get(axes[0].id)?.total ?? 0;
          return (
            <section key={g.key} className={s.sumCol}>
              <h3 className={s.sumHead}>
                {g.title}
                <span>
                  {axes[0].level === "prj" ? "과제" : "요구사항"} {n}건
                </span>
              </h3>
              {axes.map((a) => (
                <StackBar key={a.id} a={a} dist={dists.get(a.id)!} picked={filters[a.id]} onPick={(v) => onPick(a.id, v)} />
              ))}
            </section>
          );
        })}
      </div>
    </Panel>
  );
});

function StackBar({ a, dist, picked, onPick }: { a: Axis; dist: AxisDist; picked?: string; onPick: (v: string) => void }) {
  const { rows, total, blank, warns } = dist;
  const filled = rows.map((r, i) => ({ ...r, i })).filter((r) => r.n > 0);
  return (
    <div className={s.sb}>
      <div className={s.sbHead}>
        <span className={s.sbLabel}>{a.label}</span>
        {warns.length > 0 && (
          <span className={s.sbWarn} title={warns.join("\n")}>
            <Icon name="alert" size={12} />
            {warns[0]}
            {warns.length > 1 && ` 외 ${warns.length - 1}`}
          </span>
        )}
      </div>
      <div className={s.sbBar}>
        {filled.map((r) => {
          const share = r.n / (total || 1);
          return (
            <button key={r.v} type="button" className={`${s.sbSeg} ${picked === r.v ? s.sbPicked : ""}`} style={{ flexGrow: r.n, ...rank(r.i, a.options.length) }} onClick={() => onPick(r.v)} title={`${r.v} ${r.n}건 (${Math.round(share * 100)}%) — 표에서 보기`}>
              {/* 좁으면 이름부터 줄어들고 숫자는 남는다 */}
              <span className={s.sbV}>{r.v}</span>
              <b>{r.n}</b>
            </button>
          );
        })}
        {blank > 0 && (
          <button type="button" className={`${s.sbSeg} ${s.sbBlank} ${picked === BLANK ? s.sbPicked : ""}`} style={{ flexGrow: blank }} onClick={() => onPick(BLANK)} title={`미입력 ${blank}건 — 표에서 보기`}>
            <span className={s.sbV}>미입력</span>
            <b>{blank}</b>
          </button>
        )}
      </div>
    </div>
  );
}
