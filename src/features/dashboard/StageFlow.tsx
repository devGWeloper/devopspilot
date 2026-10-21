"use client";

import { Fragment, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Segmented } from "@/components/ui/Tabs";
import { f1, man, pct } from "@/lib/format";
import type { Agg } from "@/lib/measure/metrics";
import { STAGE_LABEL, STAGES, type StageCd } from "@/lib/types";
import type { DashVM } from "@/lib/views";
import d from "./dashboard.module.css";

type Basis = "md" | "cost";

interface Line {
  key: string;
  label: string;
  sub: string;
  total: Agg;
  stages: Partial<Record<StageCd, Agg>>;
  indent?: boolean;
  onClick?: () => void;
  open?: boolean;
}

const actual = (a: Agg, b: Basis) => (b === "md" ? a.md : a.totalCost);
const base = (a: Agg, b: Basis) => (b === "md" ? a.baseMd : a.baseCost);
const fmt = (v: number, b: Basis) => (b === "md" ? `${f1(v)} M/D` : `${man(v)}만원`);

/** 과제·요구사항마다 분석→설계→개발→테스트를 앞 단계가 끝난 자리에서 이어 그린다 — 어느 공정에 공수·비용이 몰렸는지 */
export function StageFlow({ vm }: { vm: DashVM }) {
  const [basis, setBasis] = useState<Basis>("md");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const lines: Line[] = vm.projects.flatMap((p) => {
    const reqs = vm.matrix.filter((m) => m.prjId === p.prjId);
    return [
      {
        key: p.prjId,
        label: p.prjNm,
        sub: `${p.prjId} · 요구사항 ${reqs.length}건`,
        total: p.agg,
        stages: p.stages,
        onClick: reqs.length ? () => toggle(p.prjId) : undefined,
        open: open.has(p.prjId),
      },
      ...(open.has(p.prjId)
        ? reqs.map((m) => ({
            key: m.rk,
            label: m.name || m.reqId,
            sub: m.rk,
            total: m.total,
            stages: Object.fromEntries(Object.entries(m.cells).flatMap(([cd, c]) => (c?.agg ? [[cd, c.agg]] : []))) as Partial<Record<StageCd, Agg>>,
            indent: true,
          }))
        : []),
    ];
  });

  return (
    <Panel
      flush
      title="SDLC 단계 흐름 — 과제·요구사항별 투입 공수·비용"
      style={{ marginTop: 20 }}
      actions={
        <Segmented<Basis>
          ariaLabel="막대 기준"
          value={basis}
          onChange={setBasis}
          options={[
            { key: "md", label: "공수 (M/D)" },
            { key: "cost", label: "비용 (만원)" },
          ]}
        />
      }
    >
      <p className={d.sub} style={{ padding: "0 20px 8px" }}>
        막대 = 실제 {basis === "md" ? "투입 공수" : "비용(인건비 + AI 비용)"}, 점선 = 기준. 단계는 앞 단계가 끝난 자리에서 이어집니다. 빨간 막대는 기준보다 더 든 단계입니다. 과제를 누르면 요구사항이 펼쳐집니다.
      </p>
      <div className={d.flow}>
        <div className={d.flowHead}>
          <span>과제 · 요구사항</span>
          <span>기준 → 실제</span>
          <span />
        </div>
        {lines.map((l) => (
          <FlowLine key={l.key} l={l} basis={basis} />
        ))}
      </div>
    </Panel>
  );
}

function FlowLine({ l, basis }: { l: Line; basis: Basis }) {
  const cds = STAGES.filter((cd) => l.stages[cd]);
  let cur = 0;
  const segs = cds.map((cd) => {
    const a = l.stages[cd]!;
    const s = { cd, a, from: cur, act: actual(a, basis), base: base(a, basis) };
    cur += s.act;
    return s;
  });
  // 줄마다 자기 크기에 맞춰 그린다 — 큰 과제에 눌려 작은 과제의 단계 비중이 안 보이는 것을 막으려고. 숫자는 라벨로 읽는다.
  const max = Math.max(1e-9, ...segs.map((s) => s.from + Math.max(s.act, s.base)));
  const w = (v: number) => `${(Math.max(0, v) / max) * 100}%`;
  const T = l.total;
  return (
    <div className={`${d.flowRow} ${l.indent ? d.flowIndent : ""} ${l.onClick ? d.click : ""}`} onClick={l.onClick}>
      <div className={d.flowName}>
        <b>
          {l.onClick && <span className={d.caret}>{l.open ? "▾" : "▸"}</span>}
          {l.label}
        </b>
        <span className={d.sub}>{l.sub}</span>
      </div>
      <div className={d.flowTot}>
        <span className="num">
          {fmt(base(T, basis), basis)} → <b>{fmt(actual(T, basis), basis)}</b>
        </span>
        <span className={d.sub}>
          공수 절감 {pct(T.save, 1)} · 비용 순절감 {pct(T.net, 1)}
        </span>
      </div>
      <div className={d.flowChart} style={{ height: Math.max(1, segs.length) * 24 + 4 }}>
        {segs.length === 0 && <span className="subtle">집계된 단계 없음</span>}
        {segs.map((s, i) => {
          const over = s.act > s.base + 1e-9;
          const end = (s.from + Math.max(s.act, s.base)) / max;
          const start = s.from / max;
          // 라벨은 막대 오른쪽 → 왼쪽 → 막대 안 순으로 자리가 있는 곳에 둔다.
          const place = end < 0.62 ? "right" : start > 0.38 ? "left" : "in";
          const pos =
            place === "right" ? { left: `calc(${end * 100}% + 6px)` } : place === "left" ? { right: `calc(${100 - start * 100}% + 6px)` } : { left: `calc(${start * 100}% + 6px)` };
          const tip = [
            `${STAGE_LABEL[s.cd]}`,
            `공수 기준 ${f1(s.a.baseMd)} → 실제 ${f1(s.a.md)} M/D (${pct(s.a.save, 1)})`,
            `비용 기준 ${man(s.a.baseCost)} → 인건비 ${man(s.a.labor)} + AI ${man(s.a.aiCost)} = ${man(s.a.totalCost)}만원`,
          ].join("\n");
          return (
            <Fragment key={s.cd}>
              <span className={d.flowBase} style={{ left: w(s.from), width: w(s.base), top: i * 24 + 3 }} />
              <span className={`${d.flowBar} ${over ? d.flowOver : ""}`} style={{ left: w(s.from), width: w(s.act), top: i * 24 + 5 }} title={tip} />
              <span className={`${d.flowLabel} ${place === "in" ? d.flowIn : over ? d.mxOver : ""}`} style={{ ...pos, top: i * 24 + 3 }} title={tip}>
                <b>{STAGE_LABEL[s.cd]}</b> {f1(s.a.md)} M/D · {man(s.a.totalCost)}만원
              </span>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
