"use client";

import { memo, useMemo, useState } from "react";
import { Select } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { f1 } from "@/lib/format";
import { STAGE_LABEL, STAGES, type StageCd } from "@/lib/types";
import type { SelPrjVM, SelReqVM, SelectionVM } from "@/lib/views";
import { AXIS_BY_ID, LEVEL_AXES, levelAvg, stageSums, type StageSum } from "./axes";
import s from "./selection.module.css";

// 겹침 풀기에만 쓰는 기준 크기(px) — 그림은 비율(%)로 늘어난다.
const W = 640;
const H = 320;
// 하(1)·상(3) 바깥에 여백을 둬 끝 값의 원이 축에 걸리지 않게.
const LO = 0.6;
const HI = 3.4;
const R_MIN = 11;
const R_MAX = 30;
const TICKS = [
  { v: 1, t: "하" },
  { v: 2, t: "중" },
  { v: 3, t: "상" },
];
// 단계 순서대로 진해진다 — 막대 하나로 공수가 앞(분석)·뒤(테스트) 어디에 몰렸는지 읽힌다.
const STAGE_SHADE: Record<StageCd, number> = { AN: 0.2, DS: 0.4, DV: 0.62, TS: 0.85 };

// 자주 보는 축 조합 — 선정 양식 정의상 명세·맥락·생성 패턴은 개발자 평가, 예상 기대효과는 그걸 보고 PM 이 판단한 값.
const PRESETS: { x: string; y: string; label: string; why: string }[] = [
  { x: "REQ-04", y: "FIT-06", label: "난이도 × 기대효과", why: "어려운 요구사항에도 AI 효과를 기대하는지" },
  { x: "FIT-02", y: "FIT-01", label: "맥락 × 명세", why: "AI 에 넣을 입력(무엇을·어떤 맥락으로)이 준비된 정도 — 개발자 평가" },
  { x: "FIT-03", y: "FIT-06", label: "생성 패턴 × 기대효과", why: "패턴 반복일수록 기대효과를 높게 봤는지" },
  { x: "FIT-01", y: "FIT-06", label: "명세 × 기대효과", why: "개발자 평가(명세 명확성)와 PM 판단(예상 기대효과)이 같은 방향인지" },
];

const posX = (v: number) => ((v - LO) / (HI - LO)) * W;
const posY = (v: number) => (1 - (v - LO) / (HI - LO)) * H;

interface Dot {
  no: number;
  p: SelPrjVM;
  reqs: SelReqVM[];
  md: number;
  stages: StageSum[];
  x: number | null;
  y: number | null;
  r: number;
}

/** 같은 자리에 몰린 원을 서로 밀어낸다 — 평균이 같은 과제가 많아 그대로 두면 한 점으로 겹친다. */
function relax(dots: Dot[]) {
  const ps = dots.filter((d): d is Dot & { x: number; y: number } => d.x !== null && d.y !== null);
  for (let it = 0; it < 80; it++) {
    let moved = false;
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.r + b.r + 4;
        if (d >= min) continue;
        // 완전히 겹치면 번호로 방향을 정해 그릴 때마다 같은 모양이 되게
        const [ux, uy] = d > 0.01 ? [dx / d, dy / d] : [Math.cos(j * 2.4), Math.sin(j * 2.4)];
        const push = (min - d) / 2;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    for (const d of ps) {
      d.x = Math.min(W - d.r, Math.max(d.r, d.x));
      d.y = Math.min(H - d.r, Math.max(d.r, d.y));
    }
    if (!moved) break;
  }
}

function dotsOf(vm: SelectionVM, xId: string, yId: string): Dot[] {
  const maxMd = Math.max(1, ...vm.projects.map((p) => p.baseMd));
  const dots = vm.projects.map((p, i): Dot => {
    const reqs = vm.reqs.filter((r) => r.prjId === p.prjId);
    const ax = levelAvg(reqs, xId);
    const ay = levelAvg(reqs, yId);
    const md = reqs.reduce((a, r) => a + r.baseMd, 0);
    return {
      no: i + 1,
      p,
      reqs,
      md,
      stages: stageSums(reqs),
      x: ax === null || ay === null ? null : posX(ax),
      y: ax === null || ay === null ? null : posY(ay),
      // 넓이가 기준 공수에 비례하도록 반지름은 제곱근
      r: R_MIN + (R_MAX - R_MIN) * Math.sqrt(md / maxMd),
    };
  });
  relax(dots);
  return dots;
}

const levelText = (reqs: SelReqVM[], id: string) => {
  const n = (v: string) => reqs.filter((r) => (r.values[id] ?? "").trim() === v).length;
  return TICKS.slice()
    .reverse()
    .map((t) => `${t.t} ${n(t.t)}`)
    .join(" · ");
};

/** 과제마다 원 하나 — 자리는 요구사항·단계 값의 평균, 크기는 기준 공수. 오른쪽 목록과 번호로 짝을 맞춘다. */
export const ProjectMap = memo(function ProjectMap({ vm, picked, onPick }: { vm: SelectionVM; picked?: string; onPick: (prjNm: string) => void }) {
  const [xId, setXId] = useState(PRESETS[0].x);
  const [yId, setYId] = useState(PRESETS[0].y);
  const [hot, setHot] = useState<string | null>(null);
  const dots = useMemo(() => dotsOf(vm, xId, yId), [vm, xId, yId]);
  const unplaced = dots.filter((d) => d.x === null);
  const xLabel = AXIS_BY_ID[xId].label;
  const yLabel = AXIS_BY_ID[yId].label;
  const focus = hot ?? picked ?? null;
  const hover = (id: string | null) => () => setHot(id);

  const axisSelect = (value: string, other: string, set: (v: string) => void, label: string) => (
    <Select value={value} onChange={(e) => set(e.target.value)} aria-label={label} className={s.mapSelect}>
      {LEVEL_AXES.filter((id) => id !== other).map((id) => (
        <option key={id} value={id}>
          {AXIS_BY_ID[id].label}
        </option>
      ))}
    </Select>
  );

  return (
    <Panel
      title="선정 과제 분포"
      flush
      actions={
        <div className={s.mapAxes}>
          <span>가로</span>
          {axisSelect(xId, yId, setXId, "가로 축")}
          <span>세로</span>
          {axisSelect(yId, xId, setYId, "세로 축")}
        </div>
      }
    >
      <div className={s.mapGrid}>
        <div className={s.mapSide}>
          <div className={s.presets} role="group" aria-label="추천 축">
            <span>추천</span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`${s.preset} ${p.x === xId && p.y === yId ? s.presetOn : ""}`}
                aria-pressed={p.x === xId && p.y === yId}
                onClick={() => (setXId(p.x), setYId(p.y))}
                title={`가로 ${AXIS_BY_ID[p.x].label} × 세로 ${AXIS_BY_ID[p.y].label} — ${p.why}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className={s.mapNote}>원 하나 = 과제 하나(번호는 오른쪽 목록) · 자리 = 요구사항·단계 값의 평균 · 크기 = 기준 공수</p>
          <div className={s.map}>
            <span className={s.axY}>↑ {yLabel}</span>
            <div className={s.plot}>
              {TICKS.map((t) => (
                <span key={`x${t.v}`} className={s.gx} style={{ left: `${(posX(t.v) / W) * 100}%` }}>
                  <span className={s.tx}>{t.t}</span>
                </span>
              ))}
              {TICKS.map((t) => (
                <span key={`y${t.v}`} className={s.gy} style={{ top: `${(posY(t.v) / H) * 100}%` }}>
                  <span className={s.ty}>{t.t}</span>
                </span>
              ))}
              {dots.map((d) =>
                d.x === null || d.y === null ? null : (
                  <button
                    key={d.p.prjId}
                    type="button"
                    className={`${s.dot} ${focus === d.p.prjNm ? s.dotHot : focus ? s.dotDim : ""}`}
                    style={{ left: `${(d.x / W) * 100}%`, top: `${(d.y / H) * 100}%`, width: d.r * 2, height: d.r * 2 }}
                    onMouseEnter={hover(d.p.prjNm)}
                    onMouseLeave={hover(null)}
                    onFocus={hover(d.p.prjNm)}
                    onBlur={hover(null)}
                    onClick={() => onPick(d.p.prjNm)}
                    aria-label={`${d.no}. ${d.p.prjNm}`}
                  >
                    {d.no}
                    {/* 이름은 목록과 번호로 잇고, 겹치지 않게 짚은 원에만 띄운다 */}
                    {focus === d.p.prjNm && (
                      <span className={`${s.dotTip} ${d.y < H * 0.4 ? s.dotTipDown : ""}`}>
                        <b>{d.p.prjNm}</b>
                        <span>
                          기준 {f1(d.md)} M/D · 요구사항 {d.p.reqN} · 단계 {d.reqs.length}
                        </span>
                        <span>
                          {xLabel} {levelText(d.reqs, xId)}
                        </span>
                        <span>
                          {yLabel} {levelText(d.reqs, yId)}
                        </span>
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
            <span className={s.axX}>{xLabel} →</span>
          </div>
          {unplaced.length > 0 && (
            <p className={s.mapNote}>
              {xLabel}·{yLabel} 값이 없어 자리를 못 잡은 과제: {unplaced.map((d) => `${d.no}. ${d.p.prjNm}`).join(", ")}
            </p>
          )}
        </div>

        <div className={s.listSide}>
          <div className={s.listInner}>
            <div className={s.listHead}>
              <span>과제 {vm.projects.length}건</span>
              <span className={s.legend}>
                {STAGES.map((cd) => (
                  <span key={cd}>
                    <i style={{ background: `rgba(15, 23, 42, ${STAGE_SHADE[cd]})` }} />
                    {STAGE_LABEL[cd]}
                  </span>
                ))}
              </span>
            </div>
            <ol className={s.prjList}>
              {dots.map((d) => (
                <li key={d.p.prjId}>
                  <button
                    type="button"
                    className={`${s.prjRow} ${focus === d.p.prjNm ? s.prjRowHot : ""} ${picked === d.p.prjNm ? s.prjRowPicked : ""}`}
                    onMouseEnter={hover(d.p.prjNm)}
                    onMouseLeave={hover(null)}
                    onFocus={hover(d.p.prjNm)}
                    onBlur={hover(null)}
                    onClick={() => onPick(d.p.prjNm)}
                  >
                    <span className={s.prjNo}>{d.no}</span>
                    <span className={s.prjMain}>
                      <span className={s.prjTitle}>
                        <b>{d.p.prjNm}</b>
                        <span className={s.prjMd}>
                          {f1(d.md)} <small>M/D</small>
                        </span>
                      </span>
                      <span className={s.prjMeta}>{[d.p.deptCd, d.p.sysNm, d.p.sysGrade, d.p.area].filter(Boolean).join(" · ")}</span>
                      <span className={s.prjStages}>
                        <span className={s.mini} title={d.stages.map((x) => `${x.label} ${f1(x.baseMd)} M/D`).join(" · ")}>
                          {d.stages.map((x) => x.baseMd > 0 && <i key={x.cd} style={{ flexGrow: x.baseMd, background: `rgba(15, 23, 42, ${STAGE_SHADE[x.cd]})` }} />)}
                        </span>
                        <span>
                          요구사항 {d.p.reqN} · 단계 {d.reqs.length}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </Panel>
  );
});
