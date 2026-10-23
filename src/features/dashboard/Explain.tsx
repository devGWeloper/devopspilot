"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Tabs";
import { f1, man, pct } from "@/lib/format";
import type { Agg } from "@/lib/measure/metrics";
import x from "./explain.module.css";
import { TypeBars } from "./TypeBars";

export type ExplainKey = "save" | "net" | "use";

export interface ExplainTarget {
  key: ExplainKey;
  /** 어느 범위의 숫자인지 — 전체 · 과제명 · 요구사항 등 */
  scope: string;
  /** 원장으로 넘어갈 때 과제를 좁힌다 */
  prjId?: string;
  a: Agg;
  /** 이 숫자를 이루는 하위 줄 — 어디서 절감됐는지 */
  parts?: { key: string; label: string; a: Agg }[];
  partsTitle?: string;
}

const NAME: Record<ExplainKey, string> = { save: "공수 절감률", net: "비용 순절감률", use: "AI 활용률" };

export function ExplainModal({
  t,
  mdHours,
  onKey,
  onClose,
  onBasis,
}: {
  t: ExplainTarget | null;
  mdHours: number;
  onKey: (k: ExplainKey) => void;
  onClose: () => void;
  onBasis: () => void;
}) {
  if (!t) return null;
  const a = t.a;
  const value = t.key === "save" ? a.save : t.key === "net" ? a.net : a.use;
  return (
    <Modal
      open
      wide
      eyebrow={t.scope}
      title={
        <>
          {NAME[t.key]} <span className={x.titleVal}>{pct(value, 1)}</span>
        </>
      }
      onClose={onClose}
      footer={
        <>
          <span className={x.foot}>1 M/D = {mdHours}h · 확정된 날만 · 금액 만원</span>
          <Button icon="file" onClick={onBasis}>
            산출 근거 보기
          </Button>
        </>
      }
    >
      <Segmented<ExplainKey>
        ariaLabel="지표"
        value={t.key}
        onChange={onKey}
        options={(["save", "net", "use"] as const).map((k) => ({ key: k, label: NAME[k] }))}
      />
      {t.key === "save" && <Save a={a} mdHours={mdHours} />}
      {t.key === "net" && <Net a={a} />}
      {t.key === "use" && <Use a={a} />}
      {t.parts && t.parts.length > 1 && <Parts k={t.key} title={t.partsTitle ?? "구성"} parts={t.parts} />}
    </Modal>
  );
}

// ---------- 식 ----------

function Term({ label, v, unit, strong }: { label: string; v: string; unit?: string; strong?: boolean }) {
  return (
    <span className={`${x.term} ${strong ? x.termStrong : ""}`}>
      <span className={x.termLabel}>{label}</span>
      <span className={x.termVal}>
        {v}
        {unit && <small>{unit}</small>}
      </span>
    </span>
  );
}
const Op = ({ c }: { c: string }) => <span className={x.op}>{c}</span>;

function Eq({ children }: { children: ReactNode }) {
  return <div className={x.eq}>{children}</div>;
}

// ---------- 막대 ----------

export type Seg = { label: string; v: number; tone: "ink" | "mid" | "light" | "gap" | "over" };

/** 기준 대비 실제를 같은 눈금으로 — 남는 칸이 절감, 넘치면 초과 */
export function Bars({ base, segs, unit, fmt, gapLabel = "" }: { base?: number; segs: Seg[]; unit: string; fmt: (v: number) => string; gapLabel?: string }) {
  const used = segs.reduce((s, g) => s + g.v, 0);
  const max = Math.max(base ?? 0, used, 1e-9);
  const w = (v: number) => `${(Math.max(0, v) / max) * 100}%`;
  const gap = base === undefined ? 0 : base - used;
  return (
    <div className={x.bars}>
      {base !== undefined && (
      <div className={x.barRow}>
        <span className={x.barName}>기준</span>
        <div className={x.track}>
          <div className={`${x.seg} ${x.base}`} style={{ width: w(base) }}>
            <span>
              {fmt(base)}
              {unit}
            </span>
          </div>
        </div>
      </div>
      )}
      <div className={x.barRow}>
        <span className={x.barName}>실제</span>
        <div className={x.track}>
          {segs.filter((g) => g.v > 0).map((g) => (
            <div key={g.label} className={`${x.seg} ${x[g.tone]}`} style={{ width: w(g.v) }} title={`${g.label} ${fmt(g.v)}${unit}`}>
              {g.v / max > 0.12 && (
                <span>
                  {g.label} {fmt(g.v)}
                </span>
              )}
            </div>
          ))}
          {gap > 0 && (
            <div className={`${x.seg} ${x.gap}`} style={{ width: w(gap) }} title={`${gapLabel} ${fmt(gap)}${unit}`}>
              <span>
                {gapLabel} {fmt(gap)}
                {unit}
              </span>
            </div>
          )}
        </div>
      </div>
      {gap < 0 && (
        <div className={x.over}>
          기준보다 {fmt(-gap)}
          {unit} 더 들었습니다
        </div>
      )}
      <div className={x.legend}>
        {segs.map((g) => (
          <span key={g.label}>
            <i className={x[g.tone]} /> {g.label} {fmt(g.v)}
            {unit}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- 각 숫자의 출처 ----------

function From({ rows }: { rows: [string, string, string][] }) {
  return (
    <table className={x.from}>
      <tbody>
        {rows.map(([k, v, how]) => (
          <tr key={k}>
            <th>{k}</th>
            <td className={x.fromV}>{v}</td>
            <td className={x.fromHow}>{how}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Save({ a, mdHours }: { a: Agg; mdHours: number }) {
  const h = (v: number) => f1(v / mdHours);
  return (
    <>
      <Eq>
        <Op c="(" />
        <Term label="기준 공수" v={f1(a.baseMd)} unit="M/D" />
        <Op c="−" />
        <Term label="실제 공수" v={f1(a.md)} unit="M/D" />
        <Op c=")" />
        <Op c="÷" />
        <Term label="기준 공수" v={f1(a.baseMd)} unit="M/D" />
        <Op c="=" />
        <Term label="절감률" v={pct(a.save, 1)} strong />
      </Eq>
      <Bars
        base={a.baseMd}
        unit=" M/D"
        fmt={f1}
        gapLabel="절감"
        segs={[
          { label: "AI 사용", v: a.inT / mdHours, tone: "ink" },
          { label: "AI 없이", v: a.out / mdHours, tone: "mid" },
        ]}
      />
      <From
        rows={[
          ["기준 공수", `${f1(a.baseMd)} M/D`, `요구사항 ${a.reqN}건 · 단계 ${a.unitN}개의 기준 공수 합 (과제 선정 관리)`],
          ["실제 공수", `${f1(a.md)} M/D`, `확정한 시간 ${f1(a.tot)}h ÷ ${mdHours}h`],
          ["└ AI 사용", `${f1(a.inT)}h · ${h(a.inT)} M/D`, `Codex 자동 수집 ${f1(a.ai)}h − 개발자가 줄인 ${f1(a.ai - a.inT)}h`],
          ["└ AI 없이", `${f1(a.out)}h · ${h(a.out)} M/D`, "개발자가 작업 유형별로 직접 입력"],
          ["절감", `${f1(a.saveMd)} M/D`, "기준 공수 − 실제 공수"],
        ]}
      />
    </>
  );
}

function Net({ a }: { a: Agg }) {
  return (
    <>
      <Eq>
        <Op c="(" />
        <Term label="기준 인건비" v={man(a.baseCost)} />
        <Op c="−" />
        <Term label="실제 인건비" v={man(a.labor)} />
        <Op c="−" />
        <Term label="AI 비용" v={man(a.aiCost)} />
        <Op c=")" />
        <Op c="÷" />
        <Term label="기준 인건비" v={man(a.baseCost)} />
        <Op c="=" />
        <Term label="순절감률" v={pct(a.net, 1)} strong />
      </Eq>
      <Bars
        base={a.baseCost}
        unit="만원"
        fmt={man}
        gapLabel="순절감"
        segs={[
          { label: "인건비", v: a.labor, tone: "ink" },
          { label: "AI 비용", v: a.aiCost, tone: "mid" },
        ]}
      />
      <From
        rows={[
          ["기준 인건비", `${man(a.baseCost)}만원`, "단계마다 기준 공수 × 필요 등급 단가를 더함"],
          ["실제 인건비", `${man(a.labor)}만원`, "단계마다 실제 공수 × 같은 등급 단가를 더함"],
          ["AI 비용", `${man(a.aiCost)}만원`, a.aiNa > 0 ? `Codex 토큰 × 모델 단가 · 단가 없는 ${a.aiNa}건은 0` : "Codex 토큰 × 모델 단가"],
          ["순절감액", `${man(a.netAmt)}만원`, "기준 인건비 − 실제 인건비 − AI 비용"],
        ]}
      />
    </>
  );
}

function Use({ a }: { a: Agg }) {
  return (
    <>
      <Eq>
        <Term label="AI 사용" v={f1(a.inT)} unit="h" />
        <Op c="÷" />
        <Term label="실제 공수" v={f1(a.tot)} unit="h" />
        <Op c="=" />
        <Term label="AI 활용률" v={pct(a.use, 1)} strong />
      </Eq>
      <Bars
        unit="h"
        fmt={f1}
        segs={[
          { label: "AI 사용", v: a.inT, tone: "ink" },
          { label: "AI 없이", v: a.out, tone: "light" },
        ]}
      />
      <From
        rows={[
          ["AI 사용", `${f1(a.inT)}h`, `Codex 자동 수집 ${f1(a.ai)}h − 개발자가 줄인 ${f1(a.ai - a.inT)}h`],
          ["AI 없이", `${f1(a.out)}h`, "개발자가 작업 유형별로 직접 입력"],
          ["실제 공수", `${f1(a.tot)}h`, "AI 사용 + AI 없이 (확정된 날만)"],
        ]}
      />
      <div className={x.parts}>
        <div className={x.partsHead}>
          <span>AI 없이 한 일 — 업무 유형</span>
          <span>시간 · AI 없이 중 비중</span>
        </div>
        <TypeBars a={a} empty="AI 없이 한 시간이 없습니다." />
      </div>
    </>
  );
}

// ---------- 하위 구성 ----------

function Parts({ k, title, parts }: { k: ExplainKey; title: string; parts: NonNullable<ExplainTarget["parts"]> }) {
  const amt = (a: Agg) => (k === "save" ? a.saveMd : k === "net" ? a.netAmt : a.inT);
  const rate = (a: Agg) => (k === "save" ? a.save : k === "net" ? a.net : a.use);
  const fmt = (v: number) => (k === "save" ? `${f1(v)} M/D` : k === "net" ? `${man(v)}만원` : `${f1(v)}h`);
  const rows = [...parts].sort((p, q) => amt(q.a) - amt(p.a));
  const max = Math.max(...rows.map((r) => Math.abs(amt(r.a))), 1e-9);
  const head = k === "save" ? "절감 M/D" : k === "net" ? "순절감액" : "AI 사용";
  return (
    <div className={x.parts}>
      <div className={x.partsHead}>
        <span>{title}</span>
        <span>
          {head} · {NAME[k]}
        </span>
      </div>
      {rows.map((r) => {
        const v = amt(r.a);
        return (
          <div key={r.key} className={x.part}>
            <span className={x.partName} title={r.label}>
              {r.label}
            </span>
            <div className={x.partTrack}>
              <div className={`${x.partBar} ${v < 0 ? x.partNeg : ""}`} style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
            </div>
            <span className={`${x.partV} ${v < 0 ? x.neg : ""}`}>{fmt(v)}</span>
            <b className={`${x.partR} ${(rate(r.a) ?? 0) < 0 ? x.neg : ""}`}>{pct(rate(r.a), 1)}</b>
          </div>
        );
      })}
    </div>
  );
}
