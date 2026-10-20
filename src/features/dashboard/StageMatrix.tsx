"use client";

import { Fragment } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { f1, pct } from "@/lib/format";
import type { Agg } from "@/lib/measure/metrics";
import { STAGE_LABEL, STAGES, type StageCd } from "@/lib/types";
import type { DashVM, MatrixCellVM } from "@/lib/views";
import { STATUS_LABEL } from "../common/bits";
import d from "./dashboard.module.css";

/** 요구사항 × SDLC 단계 기준 공수 대비 실제 — 관리자가 단계별로 바로 비교하는 표 */
export function StageMatrix({ vm }: { vm: DashVM }) {
  const byStage = new Map(vm.stages.map((s) => [s.cd, s.agg]));
  const prjs = Array.from(new Map(vm.matrix.map((r) => [r.prjId, r.prjNm])));
  return (
    <Panel
      flush
      title="요구사항 × SDLC 단계 — 기준 대비"
      style={{ marginTop: 20 }}
      actions={
        <Button size="sm" icon="download" onClick={() => downloadCsv(vm)}>
          CSV
        </Button>
      }
    >
      <p className={d.sub} style={{ padding: "0 20px 8px" }}>
        칸 = 기준 → 실제 공수(M/D), 아래 공수 절감률. 빨간 칸은 기준보다 더 든 단계입니다. 측정 중인 단계는 상태만 보입니다.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className={d.table}>
          <thead>
            <tr>
              <th>과제 · 요구사항</th>
              {STAGES.map((cd) => (
                <th key={cd} className={d.r}>
                  {STAGE_LABEL[cd]}
                </th>
              ))}
              <th className={d.r}>합계</th>
            </tr>
          </thead>
          <tbody>
            <tr className={d.mxTotal}>
              <td>
                <b>단계 합계</b>
              </td>
              {STAGES.map((cd) => (
                <td key={cd} className={d.r}>
                  {byStage.get(cd) ? <Val a={byStage.get(cd)!} /> : "—"}
                </td>
              ))}
              <td className={d.r}>
                <Val a={vm.total} />
              </td>
            </tr>
            {prjs.map(([prjId, prjNm]) => (
              <Fragment key={prjId}>
                <tr className={d.mxPrj}>
                  <td colSpan={STAGES.length + 2}>{prjNm}</td>
                </tr>
                {vm.matrix
                  .filter((r) => r.prjId === prjId)
                  .map((r) => (
                    <tr key={r.rk}>
                      <td>
                        <b>{r.name || r.reqId}</b>
                        <div className={d.sub}>{r.rk}</div>
                      </td>
                      {STAGES.map((cd) => (
                        <td key={cd} className={d.r}>
                          <MxCell c={r.cells[cd]} />
                        </td>
                      ))}
                      <td className={d.r}>{r.total.unitN ? <Val a={r.total} /> : "—"}</td>
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function MxCell({ c }: { c: MatrixCellVM | undefined }) {
  if (!c) return <span className="subtle">—</span>;
  if (!c.agg)
    return (
      <span className="subtle">
        {STATUS_LABEL[c.status]}
        <div className={d.sub}>{c.ownerNm}</div>
      </span>
    );
  return (
    <>
      <Val a={c.agg} />
      <div className={d.sub}>{c.ownerNm}</div>
    </>
  );
}

function Val({ a }: { a: Agg }) {
  const over = a.md > a.baseMd + 1e-9;
  return (
    <span className={over ? d.mxOver : undefined} title={over ? "기준 공수보다 많이 들었습니다" : undefined}>
      <span className="num">
        {f1(a.baseMd)} → <b>{f1(a.md)}</b>
      </span>
      <div className={d.sub}>{pct(a.save, 0)}</div>
    </span>
  );
}

function downloadCsv(vm: DashVM) {
  const head = ["과제", "요구사항ID", "요구사항", ...STAGES.flatMap((cd) => [`${STAGE_LABEL[cd]} 기준MD`, `${STAGE_LABEL[cd]} 실제MD`, `${STAGE_LABEL[cd]} 상태`]), "합계 기준MD", "합계 실제MD", "절감률"];
  const cell = (c: MatrixCellVM | undefined) => (!c ? ["", "", ""] : [c.agg ? f1(c.agg.baseMd) : "", c.agg ? f1(c.agg.md) : "", STATUS_LABEL[c.status]]);
  const lines = [head, ...vm.matrix.map((r) => [r.prjNm, r.reqId, r.name, ...STAGES.flatMap((cd: StageCd) => cell(r.cells[cd])), f1(r.total.baseMd), f1(r.total.md), r.total.save === null ? "" : (r.total.save * 100).toFixed(1) + "%"])];
  const csv = "﻿" + lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `요구사항x단계_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
