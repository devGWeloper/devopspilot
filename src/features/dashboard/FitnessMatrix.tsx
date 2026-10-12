"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FitPair } from "@/components/ui/FitBadge";
import { Segmented } from "@/components/ui/Tabs";
import { matrixColumns, matrixRows } from "@/lib/fitnessMatrix";
import { labelOf } from "@/lib/hooks";
import { STATUS_LABEL } from "@/lib/labels";
import { FIT_LABEL } from "@/lib/fitness";
import type { CodeItem, Codes, Criteria, Project } from "@/lib/types";
import { ruleSentences } from "../project-detail/RationaleTab";
import s from "./matrix.module.css";

type Scope = "all" | "chosen";

const code = (list: CodeItem[], v: string | null | undefined) => (v ? labelOf(list, v) : "");

const INFO_COLS: { key: string; name: string; value: (p: Project, codes: Codes) => string }[] = [
  { key: "domain", name: "담당", value: (p, c) => [code(c.domains, p.domainCd), p.base.orgNm].filter(Boolean).join(" · ") },
  { key: "sysType", name: "배포 형식", value: (p, c) => code(c.sysTypes, p.sysTypeCd) },
  { key: "workArea", name: "과제 영역", value: (p, c) => code(c.workAreas, p.devTypeCd) },
  { key: "grade", name: "시스템 등급", value: (p, c) => code(c.sysGrades, p.base.sysGradeCd) },
  { key: "lang", name: "주 개발 언어", value: (p, c) => code(c.langs, p.mainLangCd) },
  { key: "aiTool", name: "AI 도구", value: (p, c) => code(c.aiTools, p.base.aiToolCd) },
];

// 적합도 상·중·하는 행(과제)마다 하나이고, 지표 칸에는 PM 이 고른 실제 값을 그대로 보인다.
export function FitnessMatrix({ projects, criteria, codes }: { projects: Project[]; criteria: Criteria; codes: Codes }) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("all");
  const [showMinor, setShowMinor] = useState(true);
  const [hoverCol, setHoverCol] = useState<string | null>(null);

  const cols = matrixColumns(criteria).filter((c) => showMinor || c.tier === "MAJOR");
  const majors = cols.filter((c) => c.tier === "MAJOR").length;
  const minors = cols.length - majors;
  const rows = matrixRows(projects, false).filter((p) => scope === "all" || p.status === "SELECTED" || p.status === "RESERVE");
  const optionOf = (p: Project, indId: string) => cols.find((c) => c.indicator.id === indId)!.indicator.options.find((o) => o.id === p.eval.answers[indId]) ?? null;
  const missing = (p: Project) => cols.filter((c) => !optionOf(p, c.indicator.id)).length;

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
          <span className={s.missingSample}>미입력</span> PM 입력 전
        </span>
      </div>
      <p className={s.rule}>
        <b>적합도</b> 과제마다 하나 — 참고 등급: {ruleSentences(criteria).slice(0, 2).join(" / ")} / 그 외 중.{" "}
        <span className="subtle">PM 이 참고 등급을 보고 예상 기대효과를 판단하고, AX 가 최종 확정합니다. 지표 칸은 과제의 실제 선택값입니다.</span>
      </p>

      <div className={s.scroll}>
        <table className={s.table}>
          <thead>
            <tr className={s.band}>
              <th className={s.stickyA} rowSpan={2}>
                후보 과제
              </th>
              <th className={s.stickyB} rowSpan={2} title="확정(AX) · 괄호는 참고 등급">
                적합도
              </th>
              <th className={s.colPm} rowSpan={2} title="양식 FIT-06 예상 기대효과">
                PM 판단
              </th>
              <th colSpan={INFO_COLS.length} className={s.bandInfo}>
                과제 정보
              </th>
              <th colSpan={majors} className={`${s.bandMajor} ${s.split}`}>
                MAJOR {majors} — 참고 등급을 정함
              </th>
              {minors > 0 && (
                <th colSpan={minors} className={`${s.bandMinor} ${s.split}`}>
                  MINOR {minors} — 보완 신호
                </th>
              )}
            </tr>
            <tr>
              {INFO_COLS.map((c) => (
                <th key={c.key} className={`${s.colHead} ${s.colInfo}`}>
                  <span className={s.colName}>{c.name}</span>
                </th>
              ))}
              {cols.map((c, i) => (
                <th
                  key={c.indicator.id}
                  className={`${s.colHead} ${c.tier === "MAJOR" ? s.colMajor : ""} ${i === 0 || i === majors ? s.split : ""} ${hoverCol === c.indicator.id ? s.colHover : ""}`}
                  title={`${c.indicator.ref ? `${c.indicator.ref} ` : ""}${c.areaName} · ${c.indicator.name}\n${c.indicator.description}\n선택값: ${c.indicator.options.map((o) => o.label).join(" / ")}`}
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
            {rows.map((p) => {
              const miss = missing(p);
              return (
                <tr key={p.prjId} className={s.row} onClick={() => router.push(`/projects/${p.prjId}?tab=rationale`)}>
                  <th className={s.stickyA} scope="row">
                    <span className={s.pname}>{p.prjNm}</span>
                    <span className={s.pmeta}>
                      {p.prjId} · <span data-st={p.status}>{STATUS_LABEL[p.status]}</span>
                      {miss > 0 && <span className={s.pmiss}> · 미입력 {miss}</span>}
                    </span>
                  </th>
                  <td className={s.stickyB}>
                    <FitPair finalFit={p.finalFit} suggestFit={p.suggestFit} size="sm" />
                  </td>
                  <td className={`${s.cell} ${s.pmCell}`} title={p.base.pmFitReason ? `판단 사유: ${p.base.pmFitReason}` : undefined}>
                    {p.base.pmFit ? <span className={s.val}>{FIT_LABEL[p.base.pmFit]}</span> : <span className={s.missing}>미입력</span>}
                  </td>
                  {INFO_COLS.map((c) => {
                    const v = c.value(p, codes);
                    return (
                      <td key={c.key} className={`${s.cell} ${s.infoCell}`}>
                        {v ? <span className={s.val}>{v}</span> : <span className={s.missing}>미입력</span>}
                      </td>
                    );
                  })}
                  {cols.map((c, i) => {
                    const o = optionOf(p, c.indicator.id);
                    return (
                      <td
                        key={c.indicator.id}
                        className={`${s.cell} ${i === 0 || i === majors ? s.split : ""} ${hoverCol === c.indicator.id ? s.colHover : ""} ${c.tier === "MINOR" ? s.minorCell : ""}`}
                        title={`${c.indicator.name}: ${o ? o.label : "미입력"}${p.eval.notes[c.indicator.id] ? `\n메모: ${p.eval.notes[c.indicator.id]}` : ""}`}
                        onMouseEnter={() => setHoverCol(c.indicator.id)}
                      >
                        {o ? <span className={s.val}>{o.label}</span> : <span className={s.missing}>미입력</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="muted" style={{ padding: 20, textAlign: "center" }}>표시할 과제가 없습니다.</p>}
      <p className={s.foot2}>
        행을 누르면 그 과제의 판정 근거로 이동합니다. 열 머리에 마우스를 올리면 양식 항목 ID·설명·선택값 목록이 보입니다.{" "}
        {criteria.areas.map((a, i) => `${["①", "②", "③", "④", "⑤", "⑥"][i] ?? ""}${a.name}`).join(" ")}.
      </p>
    </div>
  );
}
