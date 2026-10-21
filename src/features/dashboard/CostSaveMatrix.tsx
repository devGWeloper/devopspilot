"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { catsOf, DIMS, type DimKey } from "@/lib/dims";
import { man, pct } from "@/lib/format";
import type { DashVM } from "@/lib/views";
import d from "./dashboard.module.css";

const AXES = DIMS.filter((x) => x.level === "prj");
const W = 720;
const H = 380;
const M = { l: 64, r: 24, t: 20, b: 44 };
const BLANK = "미입력";

// 업무 화면은 무채색이라 범례는 색 대신 모양으로 가른다. 분류 순서대로 고정 — 필터가 바뀌어도 같은 분류는 같은 모양.
const SHAPES = ["circle", "square", "triangle", "diamond", "down", "plus", "cross"] as const;
type Shape = (typeof SHAPES)[number] | "ring";

function Mark({ shape, x, y, r = 6 }: { shape: Shape; x: number; y: number; r?: number }) {
  const p = { className: d.cmMark };
  switch (shape) {
    case "circle":
      return <circle cx={x} cy={y} r={r} {...p} />;
    case "ring":
      return <circle cx={x} cy={y} r={r - 0.5} {...p} className={d.cmRing} />;
    case "square":
      return <rect x={x - r + 0.5} y={y - r + 0.5} width={2 * r - 1} height={2 * r - 1} rx={1.5} {...p} />;
    case "triangle":
      return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y + r - 1} ${x - r - 1},${y + r - 1}`} {...p} />;
    case "down":
      return <polygon points={`${x},${y + r + 1} ${x + r + 1},${y - r + 1} ${x - r - 1},${y - r + 1}`} {...p} />;
    case "diamond":
      return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} {...p} />;
    case "plus":
      return <path d={`M${x - r} ${y}H${x + r}M${x} ${y - r}V${y + r}`} className={d.cmLine} />;
    case "cross":
      return <path d={`M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}`} className={d.cmLine} />;
  }
}

/** 과제별 AI 비용(세로) × 공수 절감률(가로) — 나누는 선은 전체 절감률과 과제 평균 AI 비용 */
export function CostSaveMatrix({ vm }: { vm: DashVM }) {
  const [axis, setAxis] = useState<DimKey>(AXES[0].key);
  const dim = AXES.find((x) => x.key === axis) ?? AXES[0];
  const pts = vm.projects.filter((p) => p.agg.save !== null);
  const cats = catsOf(dim, pts.map((p) => p.dims[axis] ?? ""));
  const shapeOf = (v: string): Shape => (v ? (SHAPES[cats.indexOf(v)] ?? "circle") : "ring");
  const used = Array.from(new Set(pts.map((p) => p.dims[axis] || BLANK)));
  const legend = [...cats.filter((c) => used.includes(c)), ...(used.includes(BLANK) ? [BLANK] : [])];

  if (pts.length === 0)
    return (
      <Panel title="AI 비용 × 공수 절감률" style={{ marginTop: 20 }}>
        <p className="muted">절감률을 계산할 과제가 없습니다.</p>
      </Panel>
    );

  const saves = pts.map((p) => p.agg.save ?? 0);
  const costs = pts.map((p) => p.agg.aiCost);
  const x0 = Math.min(0, Math.floor(Math.min(...saves) * 10) / 10);
  const x1 = Math.max(0.5, Math.ceil(Math.max(...saves) * 10) / 10);
  const y1 = Math.max(10_000, Math.max(...costs) * 1.15);
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - (v / y1) * (H - M.t - M.b);
  const xs = Array.from({ length: Math.round((x1 - x0) * 10) + 1 }, (_, i) => Math.round((x0 + i * 0.1) * 10) / 10).filter((_, i, a) => a.length <= 8 || i % 2 === 0);
  const ys = [0, 0.25, 0.5, 0.75, 1].map((k) => k * y1);
  const midX = vm.total.save ?? 0;
  const midY = costs.reduce((a, c) => a + c, 0) / costs.length;
  const quad = [
    { x: W - M.r - 8, y: M.t + 14, a: "end", t: "AI 비용 많음 · 절감 큼" },
    { x: M.l + 8, y: M.t + 14, a: "start", t: "AI 비용 많음 · 절감 작음" },
    { x: W - M.r - 8, y: H - M.b - 8, a: "end", t: "AI 비용 적음 · 절감 큼" },
    { x: M.l + 8, y: H - M.b - 8, a: "start", t: "AI 비용 적음 · 절감 작음" },
  ] as const;

  return (
    <Panel
      title="AI 비용 × 공수 절감률"
      style={{ marginTop: 20 }}
      actions={
        <Select value={axis} onChange={(e) => setAxis(e.target.value as DimKey)} aria-label="범례 기준" style={{ width: 180 }}>
          {AXES.map((x) => (
            <option key={x.key} value={x.key}>
              범례: {x.title}
            </option>
          ))}
        </Select>
      }
    >
      <div className={d.cmWrap}>
        <svg viewBox={`0 0 ${W} ${H}`} className={d.cm} role="img" aria-label="과제별 AI 비용과 공수 절감률 분포">
          {xs.map((v) => (
            <g key={`x${v}`}>
              <line x1={sx(v)} x2={sx(v)} y1={M.t} y2={H - M.b} className={d.cmGrid} />
              <text x={sx(v)} y={H - M.b + 16} textAnchor="middle" className={d.cmTick}>
                {pct(v)}
              </text>
            </g>
          ))}
          {ys.map((v) => (
            <g key={`y${v}`}>
              <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} className={d.cmGrid} />
              <text x={M.l - 8} y={sy(v) + 4} textAnchor="end" className={d.cmTick}>
                {man(v)}
              </text>
            </g>
          ))}
          {quad.map((q) => (
            <text key={q.t} x={q.x} y={q.y} textAnchor={q.a} className={d.cmQuad}>
              {q.t}
            </text>
          ))}
          <line x1={sx(midX)} x2={sx(midX)} y1={M.t} y2={H - M.b} className={d.cmMid} />
          <line x1={M.l} x2={W - M.r} y1={sy(midY)} y2={sy(midY)} className={d.cmMid} />
          <text x={sx(midX) + 4} y={H - M.b - 22} className={d.cmMidLabel}>
            전체 절감률 {pct(midX, 1)}
          </text>
          <text x={W - M.r - 4} y={sy(midY) - 5} textAnchor="end" className={d.cmMidLabel}>
            과제 평균 AI 비용 {man(midY)}만원
          </text>
          <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" className={d.cmAxis}>
            공수 절감률 →
          </text>
          <text x={14} y={(M.t + H - M.b) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(M.t + H - M.b) / 2})`} className={d.cmAxis}>
            AI 비용 (만원) →
          </text>
          {pts.map((p) => {
            const x = sx(p.agg.save ?? 0);
            const y = sy(p.agg.aiCost);
            const v = p.dims[axis] ?? "";
            return (
              <g key={p.prjId}>
                <title>{`${p.prjNm}\n${dim.title}: ${v || BLANK}\n공수 절감률 ${pct(p.agg.save, 1)} (기준 ${p.agg.baseMd.toFixed(1)} → 실제 ${p.agg.md.toFixed(1)} M/D)\nAI 비용 ${man(p.agg.aiCost)}만원${p.agg.aiNa ? ` · 단가 없는 세션 ${p.agg.aiNa}건 제외` : ""}\n비용 순절감률 ${pct(p.agg.net, 1)}`}</title>
                <circle cx={x} cy={y} r={14} className={d.cmHit} />
                <Mark shape={shapeOf(v)} x={x} y={y} />
                <text x={x > W - 160 ? x - 10 : x + 10} y={y + 4} textAnchor={x > W - 160 ? "end" : "start"} className={d.cmLabel}>
                  {p.prjNm}
                </text>
              </g>
            );
          })}
        </svg>
        <div className={d.cmLegend}>
          <b>{dim.title}</b>
          {legend.map((c) => (
            <span key={c}>
              <svg width={16} height={16} aria-hidden>
                <Mark shape={c === BLANK ? "ring" : shapeOf(c)} x={8} y={8} r={5} />
              </svg>
              {c}
            </span>
          ))}
        </div>
      </div>
      <p className={d.foot} style={{ padding: "8px 0 0" }}>
        <Icon name="info" size={13} /> 점 하나가 과제 하나입니다. AI 비용은 Codex 토큰 × 모델 단가 합계(토큰 단가가 없는 세션은 0)이고, 과제 크기에 따라 커질 수 있습니다. 점에 마우스를 올리면 숫자가 보입니다.
      </p>
    </Panel>
  );
}
