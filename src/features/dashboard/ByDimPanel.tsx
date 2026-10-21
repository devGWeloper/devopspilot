"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/ui/Panel";
import { f1, pct } from "@/lib/format";
import type { DimKey } from "@/lib/dims";
import type { Agg } from "@/lib/measure/metrics";
import type { DashVM } from "@/lib/views";
import d from "./dashboard.module.css";

// 태그 1건짜리 분류는 우연일 수 있어 비교 문장에 '표본 적음'을 붙인다.
const FEW = 2;
// 이 차이(%p) 미만이면 성격에 따른 차이로 보지 않는다.
const MIN_SPREAD = 0.1;

type Dim = DashVM["byDim"][number];

interface Insight {
  key: DimKey;
  title: string;
  lo: { cat: string; reqN: number; save: number };
  hi: { cat: string; reqN: number; save: number };
  spread: number;
}

/** 분류 축마다 절감률이 가장 낮은·높은 분류 — 숫자 비교만, 원인 해석은 하지 않는다 */
function insightsOf(dims: Dim[]): Insight[] {
  const out: Insight[] = [];
  for (const dm of dims) {
    const rs = dm.rows.filter((r) => r.reqN > 0 && r.agg.save !== null && r.cat !== "미입력");
    if (rs.length < 2) continue;
    const sorted = [...rs].sort((a, b) => (a.agg.save ?? 0) - (b.agg.save ?? 0));
    const lo = sorted[0];
    const hi = sorted[sorted.length - 1];
    const spread = (hi.agg.save ?? 0) - (lo.agg.save ?? 0);
    if (spread < MIN_SPREAD) continue;
    out.push({ key: dm.key, title: dm.title, lo: { cat: lo.cat, reqN: lo.reqN, save: lo.agg.save ?? 0 }, hi: { cat: hi.cat, reqN: hi.reqN, save: hi.agg.save ?? 0 }, spread });
  }
  return out.sort((a, b) => b.spread - a.spread);
}

export function ByDimPanel({ vm, onExport, exporting }: { vm: DashVM; onExport: () => void; exporting: boolean }) {
  const [axis, setAxis] = useState<DimKey>("fit");
  const ins = insightsOf(vm.byDim);
  const dm = vm.byDim.find((x) => x.key === axis) ?? vm.byDim[0];
  const T = vm.total;

  return (
    <Panel
      title="과제 성격별 결과"
      style={{ marginTop: 20 }}
      flush
      actions={
        <Button size="sm" icon="download" loading={exporting} onClick={onExport} title="모든 분류 축의 집계를 과제별·단계별·요구사항별 집계와 함께 내려받습니다">
          엑셀로 보기
        </Button>
      }
    >
      <div className={d.insight}>
        <b className={d.insightHead}>성격에 따라 절감률이 크게 갈린 기준 (누르면 아래 표가 바뀝니다)</b>
        {ins.length === 0 ? (
          <p className="muted">분류 사이 절감률 차이가 {Math.round(MIN_SPREAD * 100)}%p 이상인 축이 없습니다.</p>
        ) : (
          <ol className={d.insList}>
            {ins.slice(0, 3).map((x) => (
              <li key={x.key}>
                <button className={d.insBtn} onClick={() => setAxis(x.key)}>
                  <span className={d.insTitle}>{x.title}</span>
                  <span>
                    <b>{x.lo.cat}</b> {pct(x.lo.save, 1)} <span className="subtle">({x.lo.reqN}건)</span>
                    {x.lo.reqN < FEW && <span className={d.few}>표본 적음</span>}
                    <span className="subtle"> ↔ </span>
                    <b>{x.hi.cat}</b> {pct(x.hi.save, 1)} <span className="subtle">({x.hi.reqN}건)</span>
                    {x.hi.reqN < FEW && <span className={d.few}>표본 적음</span>}
                  </span>
                  <span className={d.spread}>차이 {Math.round(x.spread * 1000) / 10}%p</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className={d.dimBar}>
        <Select value={axis} onChange={(e) => setAxis(e.target.value as DimKey)} aria-label="분류 축" style={{ width: 220 }}>
          {vm.byDim.map((x) => (
            <option key={x.key} value={x.key}>
              {x.title}
            </option>
          ))}
        </Select>
        <span className="subtle" style={{ fontSize: 12 }}>
          세로선 = 전체 평균 {pct(T.save, 1)}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className={d.table}>
          <thead>
            <tr>
              <th>{dm.title}</th>
              <th className={d.r}>단계 수</th>
              <th className={d.r}>기준 → 실제 공수 (M/D)</th>
              <th style={{ width: "36%" }}>공수 절감률</th>
              <th className={d.r}>전체 대비</th>
            </tr>
          </thead>
          <tbody>
            {dm.rows.map((r) => (
              <tr key={r.cat} className={r.reqN ? undefined : d.dim0}>
                <td>
                  <b>{r.cat}</b>
                  {r.reqN > 0 && r.reqN < FEW && <span className={d.few}>표본 적음</span>}
                </td>
                <td className={d.r}>{r.reqN || "—"}</td>
                {r.reqN ? <Cells a={r.agg} total={T} /> : <td colSpan={3} className="subtle">표본 없음 — 이 성격은 비교할 수 없습니다</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={d.foot}>
        <Icon name="info" size={13} /> 기준정보 엑셀의 과제 성격 값으로 묶어 같은 산식으로 계산했습니다. &apos;표본 적음&apos;은 1건뿐이라 우연일 수 있습니다.
      </p>
    </Panel>
  );
}

function Cells({ a, total }: { a: Agg; total: Agg }) {
  const diff = a.save !== null && total.save !== null ? a.save - total.save : null;
  const w = (v: number | null) => `${Math.max(0, Math.min(100, (v ?? 0) * 100))}%`;
  return (
    <>
      <td className={d.r}>
        {f1(a.baseMd)} <span className="subtle">→</span> {f1(a.md)}
      </td>
      <td>
        <div className={d.sbar}>
          <i style={{ width: w(a.save) }} className={a.save !== null && a.save < 0 ? d.neg : undefined} />
          {total.save !== null && <span style={{ left: w(total.save) }} />}
          <b>{pct(a.save, 1)}</b>
        </div>
      </td>
      <td className={`${d.r} ${diff !== null && diff < -0.1 ? d.low : ""}`}>{diff === null ? "—" : `${diff >= 0 ? "+" : ""}${Math.round(diff * 1000) / 10}%p`}</td>
    </>
  );
}
