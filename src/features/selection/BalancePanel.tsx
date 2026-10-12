"use client";

import { Checkbox } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { analyzeBalance } from "@/lib/balance";
import { FIT_COLOR, FIT_LABEL, FIT_SOFT } from "@/lib/labels";
import { LEVELS, type Codes, type Criteria, type Project } from "@/lib/types";
import s from "./board.module.css";

function Bars({ title, rows }: { title: string; rows: { label: string; n: number; target?: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.n, r.target ?? 0)));
  return (
    <div className={s.bpSection}>
      <span className="eyebrow">{title}</span>
      {rows.map((r) => (
        <div key={r.label} className={s.bpRow}>
          <span className={s.bpLabel}>{r.label}</span>
          <span className={s.bpTrack}>
            <span className={s.bpFill} style={{ width: `${(r.n / max) * 100}%`, opacity: r.n ? 1 : 0 }} />
            {r.target !== undefined && <span className={s.bpTarget} style={{ left: `${(r.target / max) * 100}%` }} />}
          </span>
          <span className={`num ${r.target !== undefined && r.n < r.target ? s.bpShort : ""}`}>{r.n}</span>
        </div>
      ))}
    </div>
  );
}

export function BalancePanel({
  projects,
  criteria,
  codes,
  withReserve,
  onToggleReserve,
}: {
  projects: Project[];
  criteria: Criteria;
  codes: Codes;
  withReserve: boolean;
  onToggleReserve: (v: boolean) => void;
}) {
  const r = analyzeBalance(projects, criteria, codes, withReserve ? ["SELECTED", "RESERVE"] : ["SELECTED"]);
  const t = codes.target;
  const pct = Math.min(100, (r.selectedCount / Math.max(1, t.total)) * 100);

  return (
    <aside className={s.panel} aria-label="균형 체크">
      <div className={s.bpHead}>
        <span className="eyebrow">Portfolio balance</span>
        <h2 className="h2">균형 체크</h2>
        <Checkbox label="예비 포함" checked={withReserve} onChange={(e) => onToggleReserve(e.target.checked)} />
      </div>

      <div className={s.bpTotal}>
        <div>
          <span className={s.bpBig}>{r.selectedCount}</span>
          <span className="muted"> / 목표 {t.total}건</span>
        </div>
        <span className={s.bpTrack} style={{ height: 6 }}>
          <span className={s.bpFill} style={{ width: `${pct}%` }} />
        </span>
      </div>

      <div className={s.fitGauges}>
        {LEVELS.map((lv) => {
          const n = r.byFit[lv];
          const goal = t.byFit[lv];
          return (
            <div key={lv} className={s.fitGauge} style={{ background: FIT_SOFT[lv], color: FIT_COLOR[lv] }}>
              <span className={s.fitGaugeLabel}>{FIT_LABEL[lv]}</span>
              <span className={s.fitGaugeNum}>
                {n}
                <small>/{goal}</small>
              </span>
              <span className={s.fitDots}>
                {Array.from({ length: Math.max(goal, n) }, (_, i) => (
                  <span key={i} className={s.fitDot} data-on={i < n ? "1" : "0"} style={{ borderColor: FIT_COLOR[lv], background: i < n ? FIT_COLOR[lv] : "transparent" }} />
                ))}
              </span>
            </div>
          );
        })}
      </div>

      {r.warnings.length > 0 ? (
        <ul className={s.warnList}>
          {r.warnings.map((w) => (
            <li key={w.message}>
              <Icon name="alert" size={14} />
              {w.message}
            </li>
          ))}
        </ul>
      ) : (
        <div className={s.allGood}>
          <Icon name="check" size={14} /> 목표한 균형을 모두 충족했습니다.
        </div>
      )}

      <Bars
        title="과제 영역"
        rows={codes.workAreas.map((o) => ({ label: o.label, n: r.byDevType[o.code] ?? 0, target: o.code === "MIXED" ? undefined : t.minPerDevType }))}
      />
      <Bars title="배포 형식" rows={codes.sysTypes.map((d) => ({ label: d.label, n: r.bySysType[d.code] ?? 0 }))} />
      <Bars title="담당" rows={codes.domains.map((d) => ({ label: d.label, n: r.byDomain[d.code] ?? 0 }))} />
      <Bars title="주 개발 언어" rows={codes.langs.map((l) => ({ label: l.label, n: r.byLang[l.code] ?? 0 })).filter((x) => x.n > 0 || r.selectedCount === 0).slice(0, 7)} />
    </aside>
  );
}
