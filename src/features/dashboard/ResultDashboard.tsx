"use client";

import { usePathname, useRouter } from "next/navigation";
import { Fragment, useState, useTransition, type ReactNode } from "react";
import { f1, man, pct } from "@/lib/format";
import type { Agg } from "@/lib/measure/metrics";
import { ACT_TYPES } from "@/lib/measure/types";
import { STAGE_LABEL, type StageCd } from "@/lib/types";
import type { DashFilter, DashVM } from "@/lib/views";
import { StatusText } from "../common/bits";
import b from "../common/board.module.css";
import d from "./dashboard.module.css";

function Card({ area, name, value, formula, children }: { area: string; name: string; value: string; formula: ReactNode; children?: ReactNode }) {
  return (
    <div className={d.kc}>
      <div className={b.xs}>{area}</div>
      <div className={d.nm}>{name}</div>
      <div className={d.v}>{value}</div>
      <div className={d.f}>{formula}</div>
      {children}
    </div>
  );
}

/** 기준 인건비 막대 vs 측정(인건비 + AI 비용) 막대 — 같은 척도 */
function CostBars({ a, max }: { a: Agg; max: number }) {
  const w = (v: number) => `${max > 0 ? Math.max(0, (v / max) * 100) : 0}%`;
  return (
    <div className={d.bars}>
      <div>
        <span className={d.lane}>
          <span className={d.track} style={{ width: w(a.baseCost) }}>
            <i style={{ width: "100%", background: "var(--line-strong)" }} />
          </span>
        </span>
        <span className="num">{man(a.baseCost)}</span>
      </div>
      <div>
        <span className={d.lane}>
          <span className={d.track} style={{ width: w(a.totalCost) }}>
            <i style={{ width: a.totalCost ? `${(a.labor / a.totalCost) * 100}%` : 0, background: "var(--ink-2)" }} />
            <i style={{ width: a.totalCost ? `${(a.aiCost / a.totalCost) * 100}%` : 0, background: "var(--subtle)" }} />
          </span>
        </span>
        <span className="num">
          {man(a.labor)} + {man(a.aiCost)}
        </span>
      </div>
    </div>
  );
}

function AggCells({ a }: { a: Agg }) {
  return (
    <>
      <td className="r">{f1(a.baseMd)}</td>
      <td className="r">{f1(a.md)}</td>
      <td className="r">{pct(a.save, 1)}</td>
      <td className="r">{pct(a.use)}</td>
      <td className="r">{pct(a.net, 1)}</td>
    </>
  );
}

const AGG_HEAD = (
  <>
    <th className="r">기준 M/D</th>
    <th className="r">투입 M/D</th>
    <th className="r">공수 절감</th>
    <th className="r">AI 활용</th>
    <th className="r">순절감</th>
  </>
);

const LEGEND = (
  <div className={b.sleg} style={{ marginTop: 8 }}>
    <span>
      <i style={{ background: "var(--line-strong)" }} />
      기준 인건비
    </span>
    <span>
      <i style={{ background: "var(--ink-2)" }} />
      측정 인건비
    </span>
    <span>
      <i style={{ background: "var(--subtle)" }} />
      AI 비용
    </span>
    <span>만 원</span>
  </div>
);

export function ResultDashboard({ vm, scopeNote }: { vm: DashVM; scopeNote: string }) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  const [closed, setClosed] = useState<Set<StageCd>>(new Set());
  const A = vm.total;

  function go(patch: Partial<DashFilter>) {
    const n = { ...vm.filter, ...patch };
    if (patch.kind !== undefined) n.prjId = "";
    const q = new URLSearchParams();
    if (n.kind) q.set("kind", n.kind);
    if (n.prjId) q.set("prj", n.prjId);
    if (n.includeIng) q.set("ing", "1");
    start(() => router.push(`${path}${q.size ? `?${q}` : ""}`, { scroll: false }));
  }

  const types = ACT_TYPES.map((t) => ({ t, h: A.byType[t.cd] ?? 0 })).filter((x) => x.h > 0);
  const tyTot = types.reduce((a, x) => a + x.h, 0);
  const maxStage = Math.max(1, ...vm.stages.map((s) => Math.max(s.agg.baseCost, s.agg.totalCost)));
  const maxPrj = Math.max(1, ...vm.projects.map((p) => Math.max(p.agg.baseCost, p.agg.totalCost)));

  return (
    <div style={{ opacity: pending ? 0.6 : 1, transition: "opacity 120ms" }}>
      <div className={b.head}>
        <div>
          <h1 className={b.title}>측정 결과</h1>
          <span className={b.note}>{scopeNote} · 확정된 공수만 집계 · 입력값 그대로 계산 (기준 = 엑셀 REQ-06·단계 기준 M/D)</span>
        </div>
      </div>

      <div className={b.filters}>
        <div className={b.seg}>
          {(["", "개발", "운영"] as const).map((k) => (
            <button key={k || "all"} aria-pressed={vm.filter.kind === k} onClick={() => go({ kind: k })}>
              {k ? `${k} 과제` : "전체"}
            </button>
          ))}
        </div>
        <select className={b.sel} value={vm.filter.prjId} onChange={(e) => go({ prjId: e.target.value })} aria-label="과제">
          <option value="">과제 전체</option>
          {vm.projectOptions.map((p) => (
            <option key={p.prjId} value={p.prjId}>
              {p.prjNm}
            </option>
          ))}
        </select>
        <label className={b.small} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={vm.filter.includeIng} onChange={(e) => go({ includeIng: e.target.checked })} /> 측정 중 요구사항 포함
        </label>
        <span className={b.xs} style={{ marginLeft: "auto" }}>
          요구사항 {A.reqN}건 · SDLC 단계 {A.unitN}개 집계
        </span>
      </div>

      {A.reqN === 0 ? (
        <div className={d.empty}>선택한 조건에 측정 완료된 요구사항이 없습니다. &apos;측정 중 요구사항 포함&apos;을 켜거나 조건을 바꿔 보세요.</div>
      ) : (
        <>
          <div className={d.kpi}>
            <Card area="생산성" name="투입 공수 절감률" value={pct(A.save, 1)} formula={<>(기준 {f1(A.baseMd)} − 투입 {f1(A.md)}) ÷ 기준 {f1(A.baseMd)} M/D</>} />
            <Card
              area="경제성"
              name="순절감률"
              value={pct(A.net, 1)}
              formula={
                <>
                  (기준 {man(A.baseCost)} − 인건비 {man(A.labor)} − AI {man(A.aiCost)}) ÷ 기준 {man(A.baseCost)} · 만 원
                </>
              }
            />
            <Card area="활용성" name="AI 활용률" value={pct(A.use)} formula={<>AI 도구 내 {f1(A.inT)}h ÷ 투입 {f1(A.tot)}h</>} />
            <Card area="입력 원값" name="확정 공수 합계" value={`${f1(A.tot)}h`} formula={<>= {f1(A.md)} M/D ({vm.settings.mdHours}h = 1 M/D)</>}>
              <div className={d.kv}>
                <span>AI 수집</span>
                <b>{f1(A.ai)}h</b>
              </div>
              <div className={d.kv}>
                <span>감소 반영 후 AI 도구 내</span>
                <b>{f1(A.inT)}h</b>
              </div>
              <div className={d.kv}>
                <span>AI 도구 외 (수기)</span>
                <b>{f1(A.out)}h</b>
              </div>
            </Card>
          </div>

          <div className={b.grid2}>
            <section className={d.panel}>
              <div className={d.ph}>
                <h3>SDLC 단계별 결과</h3>
                <span className={b.xs}>행을 누르면 업무 유형별로 펼침</span>
              </div>
              <div className={b.tw}>
                <table className={b.tbl}>
                  <thead>
                    <tr>
                      <th>단계 · 업무 유형</th>
                      <th style={{ minWidth: 150 }}>기준 · 측정 (인건비 + AI)</th>
                      {AGG_HEAD}
                    </tr>
                  </thead>
                  <tbody>
                    {vm.stages.map((st) => {
                      const cl = closed.has(st.cd);
                      return (
                        <Fragment key={st.cd}>
                          <tr
                            className={b.grp}
                            style={{ cursor: "pointer" }}
                            onClick={() => setClosed((x) => (x.has(st.cd) ? new Set(Array.from(x).filter((y) => y !== st.cd)) : new Set([...Array.from(x), st.cd])))}
                          >
                            <td>
                              {cl ? "▸" : "▾"} {STAGE_LABEL[st.cd]} <span className={b.xs}>{st.agg.unitN}건</span>
                            </td>
                            <td>
                              <CostBars a={st.agg} max={maxStage} />
                            </td>
                            <AggCells a={st.agg} />
                          </tr>
                          {!cl &&
                            st.workTypes.map((w) => (
                              <tr key={w.workType}>
                                <td className={b.small} style={{ paddingLeft: 24 }}>
                                  {w.workType} <span className={b.xs}>{w.agg.unitN}</span>
                                </td>
                                <td>
                                  <CostBars a={w.agg} max={maxStage} />
                                </td>
                                <AggCells a={w.agg} />
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {LEGEND}
            </section>

            <section className={d.panel}>
              <div className={d.ph}>
                <h3>과제별 결과</h3>
              </div>
              <div className={b.tw}>
                <table className={b.tbl}>
                  <thead>
                    <tr>
                      <th>과제</th>
                      <th style={{ minWidth: 150 }}>기준 · 측정 (인건비 + AI)</th>
                      {AGG_HEAD}
                    </tr>
                  </thead>
                  <tbody>
                    {vm.projects.map((p) => (
                      <tr key={p.prjId}>
                        <td>
                          <b>{p.prjNm}</b>
                          <div className={b.xs}>
                            <span className={b.pill}>{p.kind}</span> 완료 {p.doneN}/{p.reqN}
                          </div>
                        </td>
                        <td>
                          <CostBars a={p.agg} max={maxPrj} />
                        </td>
                        <AggCells a={p.agg} />
                      </tr>
                    ))}
                    {vm.projects.length > 1 && (
                      <tr className={b.sum}>
                        <td>선택 합계</td>
                        <td className={b.small}>
                          {man(A.baseCost)} → {man(A.totalCost)}
                        </td>
                        <AggCells a={A} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {LEGEND}
            </section>
          </div>

          <section className={d.panel} style={{ marginTop: 16 }}>
            <div className={d.ph}>
              <h3>AI 도구 외 시간 · 작업 유형별</h3>
              <span className={b.xs}>개발자가 직접 넣은 {f1(tyTot)}h</span>
            </div>
            {types.length ? (
              <>
                <div className={b.hbar} style={{ height: 10 }}>
                  {types.map(({ t, h }, i) => (
                    <i key={t.cd} title={`${t.cd} ${t.label} ${f1(h)}h`} style={{ width: `${(h / tyTot) * 100}%`, background: `color-mix(in srgb, var(--ink) ${85 - i * 9}%, var(--surface))` }} />
                  ))}
                </div>
                <div className={d.types}>
                  {types.map(({ t, h }) => (
                    <div key={t.cd} className={d.kv}>
                      <span>
                        {t.cd} {t.label}
                      </span>
                      <b>
                        {f1(h)}h · {pct(h / tyTot)}
                      </b>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">AI 도구 외 입력이 없습니다.</p>
            )}
          </section>

          <section className={d.panel} style={{ marginTop: 16 }}>
            <div className={d.ph}>
              <h3>요구사항별 입력값</h3>
              <span className={b.xs}>확정 공수 원값 · 금액 만 원</span>
            </div>
            <div className={b.tw}>
              <table className={b.tbl}>
                <thead>
                  <tr>
                    <th>요구사항</th>
                    <th>과제</th>
                    <th>상태</th>
                    <th>등급</th>
                    <th className="r">기준 M/D</th>
                    <th className="r">AI 도구 내 h</th>
                    <th className="r">AI 도구 외 h</th>
                    <th className="r">투입 M/D</th>
                    <th className="r">공수 절감</th>
                    <th className="r">기준 인건비</th>
                    <th className="r">측정 인건비</th>
                    <th className="r">AI 비용</th>
                    <th className="r">순절감</th>
                  </tr>
                </thead>
                <tbody>
                  {vm.reqs.map((r) => (
                    <tr key={r.reqId}>
                      <td>
                        <span className={b.mono} style={{ color: "var(--muted)" }}>
                          {r.reqId}
                        </span>{" "}
                        {r.name}
                      </td>
                      <td className={b.small}>{r.prjNm}</td>
                      <td>
                        <StatusText s={r.status} />
                      </td>
                      <td>{r.grade}</td>
                      <td className="r">{f1(r.agg.baseMd)}</td>
                      <td className="r">{f1(r.agg.inT)}</td>
                      <td className="r">{f1(r.agg.out)}</td>
                      <td className="r">{f1(r.agg.md)}</td>
                      <td className="r">{pct(r.agg.save, 1)}</td>
                      <td className="r">{man(r.agg.baseCost)}</td>
                      <td className="r">{man(r.agg.labor)}</td>
                      <td className="r">{man(r.agg.aiCost)}</td>
                      <td className="r">{pct(r.agg.net, 1)}</td>
                    </tr>
                  ))}
                  <tr className={b.sum}>
                    <td colSpan={4}>합계 {A.reqN}건</td>
                    <td className="r">{f1(A.baseMd)}</td>
                    <td className="r">{f1(A.inT)}</td>
                    <td className="r">{f1(A.out)}</td>
                    <td className="r">{f1(A.md)}</td>
                    <td className="r">{pct(A.save, 1)}</td>
                    <td className="r">{man(A.baseCost)}</td>
                    <td className="r">{man(A.labor)}</td>
                    <td className="r">{man(A.aiCost)}</td>
                    <td className="r">{pct(A.net, 1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className={b.xs} style={{ marginTop: 6 }}>
              인건비 = 투입 M/D × 등급 단가 ({Object.entries(vm.settings.gradePrice)
                .map(([g, p]) => `${g} ${man(p)}`)
                .join(" · ")}
              만 원) · AI 비용 = 수집 시간 × 도구별 시간당 비용 (시스템 관리 &gt; 코드·단가)
            </p>
          </section>
        </>
      )}
    </div>
  );
}
