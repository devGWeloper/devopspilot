"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FitPair } from "@/components/ui/FitBadge";
import { Segmented } from "@/components/ui/Tabs";
import { effectiveFit } from "@/lib/balance";
import { matrixColumns, matrixRows } from "@/lib/fitnessMatrix";
import { FIT_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { Criteria, Project } from "@/lib/types";
import { ruleSentences } from "../project-detail/RationaleTab";
import s from "./matrix.module.css";

type Scope = "all" | "chosen";

export function FitnessMatrix({ projects, criteria }: { projects: Project[]; criteria: Criteria }) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("all");
  const [showMinor, setShowMinor] = useState(true);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

  const cols = matrixColumns(criteria).filter((c) => showMinor || c.tier === "MAJOR");
  const majors = cols.filter((c) => c.tier === "MAJOR").length;
  const minors = cols.length - majors;
  const rows = matrixRows(projects, false).filter((p) => scope === "all" || p.status === "SELECTED" || p.status === "RESERVE");
  const levelOf = (p: Project, indId: string) => {
    const ind = cols.find((c) => c.indicator.id === indId)!.indicator;
    return ind.options.find((o) => o.id === p.eval.answers[indId]) ?? null;
  };

  return (
    <div className={s.wrap}>
      <div className={s.toolbar}>
        <Segmented
          ariaLabel="대상"
          value={scope}
          onChange={setScope}
          options={[
            { key: "all", label: `후보 전체 ${matrixRows(projects, false).length}` },
            { key: "chosen", label: "선정·예비만" },
          ]}
        />
        <label className={s.toggle}>
          <input type="checkbox" checked={showMinor} onChange={(e) => setShowMinor(e.target.checked)} /> Minor 지표 보기
        </label>
        <span className={s.legend}>
          <span className={s.lg} data-l="H">상</span>
          <span className={s.lg} data-l="M">중</span>
          <span className={s.lg} data-l="L">하</span>
          <span className={s.lg} data-l="none">—</span> 미응답
        </span>
      </div>
      <p className={s.rule}>
        <b>판정 규칙</b> {ruleSentences(criteria).slice(0, 2).join(" / ")} / 그 외 중 — <span className="subtle">Major 지표만 판정에 쓰고, Minor 는 보완 신호입니다.</span>
      </p>

      <div className={s.scroll}>
        <table className={s.table}>
          <thead>
            <tr className={s.band}>
              <th className={s.stickyA} rowSpan={2}>
                후보 과제
              </th>
              <th className={s.stickyB} rowSpan={2}>
                적합도
              </th>
              <th colSpan={majors} className={s.bandMajor}>
                MAJOR 지표 {majors} — 적합도 판정 기준
              </th>
              {minors > 0 && (
                <th colSpan={minors} className={s.bandMinor}>
                  MINOR 지표 {minors} — 보완 신호
                </th>
              )}
            </tr>
            <tr>
              {cols.map((c, i) => (
                <th
                  key={c.indicator.id}
                  className={`${s.colHead} ${c.tier === "MAJOR" ? s.colMajor : ""} ${i === majors ? s.split : ""} ${hoverCol === c.indicator.id ? s.colHover : ""}`}
                  title={`${c.areaName} · ${c.indicator.name}\n${c.indicator.description}\n${c.indicator.options.map((o) => `${o.label}=${FIT_LABEL[o.level]}`).join(", ")}`}
                  onMouseEnter={() => setHoverCol(c.indicator.id)}
                  onMouseLeave={() => setHoverCol(null)}
                >
                  <span className={s.area}>{["①", "②", "③", "④", "⑤", "⑥"][c.areaIndex] ?? ""}</span>
                  <span className={s.colName}>{c.indicator.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.prjId} className={s.row} onClick={() => router.push(`/projects/${p.prjId}?tab=rationale`)}>
                <th className={s.stickyA} scope="row">
                  <span className={s.pname}>{p.prjNm}</span>
                  <span className={s.pmeta}>
                    {p.prjId} · <span data-st={p.status}>{STATUS_LABEL[p.status]}</span>
                  </span>
                </th>
                <td className={s.stickyB}>
                  <FitPair finalFit={p.finalFit} suggestFit={p.suggestFit} size="sm" />
                </td>
                {cols.map((c, i) => {
                  const o = levelOf(p, c.indicator.id);
                  return (
                    <td
                      key={c.indicator.id}
                      className={`${s.cell} ${i === majors ? s.split : ""} ${hoverCol === c.indicator.id ? s.colHover : ""} ${c.tier === "MINOR" ? s.minorCell : ""}`}
                      title={`${c.indicator.name}: ${o ? `${o.label} (${FIT_LABEL[o.level]})` : "미응답"}`}
                      onMouseEnter={() => setHoverCol(c.indicator.id)}
                    >
                      <span className={s.chip} data-l={o?.level ?? "none"}>
                        {o ? FIT_LABEL[o.level] : "—"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className={s.stickyA}>하 응답 과제 수</th>
              <td className={s.stickyB}>
                <span className="subtle num">
                  {rows.filter((p) => effectiveFit(p) === "L").length}건 하
                </span>
              </td>
              {cols.map((c, i) => {
                const n = rows.filter((p) => levelOf(p, c.indicator.id)?.level === "L").length;
                return (
                  <td key={c.indicator.id} className={`${s.foot} ${i === majors ? s.split : ""}`}>
                    {n ? <b className={s.footLow}>{n}</b> : <span className="subtle">0</span>}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      {rows.length === 0 && <p className="muted" style={{ padding: 20, textAlign: "center" }}>표시할 과제가 없습니다.</p>}
      <p className={s.foot2}>
        행을 누르면 그 과제의 판정 근거로 이동합니다. 열 머리에 마우스를 올리면 지표 설명과 선택지 수준이 보입니다. ①과제 특성 ②지식 자산화 ③AI 도구 활용성 ④개발 거버넌스.
      </p>
    </div>
  );
}
