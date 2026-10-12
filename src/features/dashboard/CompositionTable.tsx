"use client";

import Link from "next/link";
import { FitPair } from "@/components/ui/FitBadge";
import { dimensions } from "@/lib/distribution";
import { labelOf } from "@/lib/hooks";
import { STATUS_LABEL } from "@/lib/labels";
import type { Codes, Criteria, Project } from "@/lib/types";
import { PHASE_NAME } from "../project-detail/OverviewTab";
import s from "./dashboard.module.css";

const mm = (v: number) => String(Math.round(v * 10) / 10);

// 선정 과제를 분류 축별 값으로 나란히 놓아, 서로 겹치는 과제가 없는지를 숫자가 아니라 값으로 확인하게 한다.
export function CompositionTable({ projects, criteria, codes }: { projects: Project[]; criteria: Criteria; codes: Codes }) {
  const dims = dimensions(codes).filter((d) => d.key !== "fit");
  const rows = projects
    .filter((p) => p.status === "SELECTED" || p.status === "RESERVE")
    .sort((a, b) => (a.status === b.status ? a.prjId.localeCompare(b.prjId) : a.status === "SELECTED" ? -1 : 1));
  const selected = rows.filter((p) => p.status === "SELECTED");
  const kinds = (of: (p: Project) => string | null) => new Set(selected.map(of).filter(Boolean)).size;

  if (rows.length === 0) return <p className="muted" style={{ fontSize: 13 }}>선정·예비 과제가 아직 없습니다.</p>;

  return (
    <div className={s.compScroll}>
      <table className={s.comp}>
        <thead>
          <tr>
            <th>과제</th>
            <th>적합도</th>
            {dims.map((d) => (
              <th key={d.key}>{d.title}</th>
            ))}
            <th>Replay 단계</th>
            <th className={s.numCol}>원 공수</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.prjId} className={p.status === "RESERVE" ? s.compReserve : undefined}>
              <td>
                <Link href={`/projects/${p.prjId}`} className={s.compName}>
                  {p.prjNm}
                </Link>
                <span className="subtle" style={{ fontSize: 11.5 }}>
                  {p.prjId} · {STATUS_LABEL[p.status]}
                </span>
              </td>
              <td>
                <FitPair finalFit={p.finalFit} suggestFit={p.suggestFit} size="sm" />
              </td>
              {dims.map((d) => {
                const v = d.of(p);
                return <td key={d.key}>{v ? labelOf(d.cats, v) : <span className="subtle">—</span>}</td>;
              })}
              <td>{p.base.baseline.replayPhases.map((ph) => PHASE_NAME[ph]).join("·") || "—"}</td>
              <td className={`${s.numCol} num`}>{p.base.baseline.totalMm !== null ? `${mm(p.base.baseline.totalMm)} M/M` : "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>선정 {selected.length}건의 다양성</th>
            <td className="num">{new Set(selected.map((p) => (p.finalFit !== "NA" ? p.finalFit : p.suggestFit))).size}종</td>
            {dims.map((d) => (
              <td key={d.key} className="num">
                {kinds(d.of)}종 <span className="subtle">/ {d.cats.length}</span>
              </td>
            ))}
            <td />
            <td className={`${s.numCol} num`}>{mm(selected.reduce((a, p) => a + (p.base.baseline.totalMm ?? 0), 0))} M/M</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
