"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, Panel } from "@/components/ui/Panel";
import { f1, man, pct, won } from "@/lib/format";
import { ACT_LABEL, type ActType } from "@/lib/measure/types";
import { STAGE_LABEL } from "@/lib/types";
import type { BasisDayVM, BasisUnitVM, BasisVM } from "@/lib/views";
import d from "./dashboard.module.css";
import b from "./basis.module.css";

const ST: Record<string, string> = { conf: "확정", edit: "재확정 필요", need: "미확정" };
const SRC: Record<string, string> = { OTEL: "텔레메트리", LOG: "로그 업로드" };
const h2 = (v: number) => (Math.round(v * 100) / 100).toString();

export function BasisView({ vm, scope }: { vm: BasisVM; scope: string }) {
  const router = useRouter();
  const A = vm.total;
  const S = vm.settings;
  const back = () => router.push(`/dashboard${typeof window !== "undefined" ? window.location.search : ""}`);

  return (
    <>
      <PageHeader
        eyebrow="측정 결과"
        title="산출 근거"
        description={`${scope} — 측정 결과 화면의 숫자가 어떤 입력값과 설정값으로 계산됐는지 보여 줍니다. 아래 원장을 모두 더하면 위 숫자가 됩니다.`}
        actions={
          <>
            <Button icon="download" onClick={() => downloadCsv(vm)}>
              원장 CSV
            </Button>
            <Button icon="chevronLeft" onClick={back}>
              측정 결과로
            </Button>
          </>
        }
      />

      {A.unitN === 0 ? (
        <Panel>
          <EmptyState title="집계 대상이 없습니다">측정 결과 화면의 조건(측정 중 포함 등)을 바꿔 보세요.</EmptyState>
        </Panel>
      ) : (
        <>
          <Panel title="계산식">
            <div className={b.formulas}>
              <Formula name="투입 공수 절감률" value={pct(A.save, 1)}>
                (기준 <b>{f1(A.baseMd)}</b> − 투입 <b>{f1(A.md)}</b>) ÷ 기준 <b>{f1(A.baseMd)}</b> M/D
                <Sub>기준 M/D = 집계 대상 요구사항·단계 {A.unitN}개의 기준 공수 합 · 절감 공수 = {f1(A.saveMd)} M/D</Sub>
                <Sub>
                  투입 M/D = 확정 공수 <b>{h2(A.tot)}h</b> ÷ 1 M/D {S.mdHours}h = {f1(A.md)} · 확정 공수 = AI 사용 {h2(A.inT)}h + AI 없이 {h2(A.out)}h
                </Sub>
              </Formula>
              <Formula name="순절감률 (비용)" value={pct(A.net, 1)}>
                (기준 인건비 <b>{man(A.baseCost)}</b> − 측정 인건비 <b>{man(A.labor)}</b> − AI 비용 <b>{man(A.aiCost)}</b>) ÷ 기준 인건비 <b>{man(A.baseCost)}</b> 만원
                <Sub>기준 인건비 = Σ 태그 기준 M/D × 태그의 필요 개발자 등급 단가 · 순절감액 = {man(A.netAmt)} 만원</Sub>
                <Sub>측정 인건비 = Σ (태그 확정 공수 ÷ {S.mdHours}h) × 등급 단가</Sub>
                <Sub>
                  AI 비용 = Σ 배정된 Codex 세션 토큰 × 모델 토큰 단가 (나눠 배정하면 분 비율로 나눔)
                  {A.aiNa > 0 && <b> · 비용 빈칸 {A.aiNa}건(토큰 미수집·단가 없음)은 0 으로 더함</b>}
                </Sub>
              </Formula>
              <Formula name="AI 활용률" value={pct(A.use)}>
                AI 사용 <b>{h2(A.inT)}h</b> ÷ 확정 공수 <b>{h2(A.tot)}h</b>
                <Sub>AI 사용 = 자동 수집 {h2(A.ai)}h − 개발자가 줄인 {h2(A.ai - A.inT)}h · AI 밖 비중 {pct(A.outShare)}</Sub>
              </Formula>
            </div>
          </Panel>

          <div className={b.two}>
            <Panel title="적용한 설정값">
              <table className={b.kv}>
                <tbody>
                  <tr>
                    <th>1 M/D</th>
                    <td>{S.mdHours}시간</td>
                  </tr>
                  {Object.entries(S.gradePrice).map(([g, p]) => (
                    <tr key={g}>
                      <th>{g} 단가</th>
                      <td>{won(p)} / M/D</td>
                    </tr>
                  ))}
                  {Object.entries(S.tokenPrice).map(([m, p]) => (
                    <tr key={m}>
                      <th>{m}</th>
                      <td>
                        입력 {won(p.input)} · 캐시 {won(p.cached)} · 출력 {won(p.output)} / 100만 토큰
                      </td>
                    </tr>
                  ))}
                  {Object.keys(S.tokenPrice).length === 0 && (
                    <tr>
                      <th>토큰 단가</th>
                      <td>미입력 — AI 비용 빈칸</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className={b.note}>기준 데이터 &gt; 04 기준정보에서 바꾸면 과거 값까지 다시 계산됩니다.</p>
            </Panel>
            <Panel title="집계에서 빠진 값">
              <table className={b.kv}>
                <tbody>
                  <tr>
                    <th>미확정·재확정 필요</th>
                    <td>
                      {vm.excluded.days}칸 · {h2(vm.excluded.hours)}h
                    </td>
                  </tr>
                  <tr>
                    <th>미배정 AI 사용</th>
                    <td>
                      {vm.pending.n}건 · {h2(vm.pending.hours)}h
                    </td>
                  </tr>
                  <tr>
                    <th>업무 외 표시</th>
                    <td>{vm.offCount}건</td>
                  </tr>
                </tbody>
              </table>
              <p className={b.note}>개발자가 확정한 날만 결과에 들어갑니다. 미배정 AI 사용은 어느 요구사항인지 정해지면 그 단계에 더해집니다.</p>
            </Panel>
          </div>

          <Ledger units={vm.units} mdHours={S.mdHours} />
        </>
      )}
    </>
  );
}

function Formula({ name, value, children }: { name: string; value: string; children: React.ReactNode }) {
  return (
    <div className={b.formula}>
      <div className={b.fHead}>
        <span>{name}</span>
        <b>{value}</b>
      </div>
      <div className={b.fBody}>{children}</div>
    </div>
  );
}

const Sub = ({ children }: { children: React.ReactNode }) => <div className={b.sub}>{children}</div>;

function Ledger({ units, mdHours }: { units: BasisUnitVM[]; mdHours: number }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOpen((x) => (x.has(k) ? new Set(Array.from(x).filter((y) => y !== k)) : new Set([...Array.from(x), k])));
  const prjs = Array.from(new Map(units.map((u) => [u.prjId, u.prjNm])));
  return (
    <Panel title="단계별 원장" flush style={{ marginTop: 20 }}>
      <p className={b.note} style={{ padding: "0 20px 12px" }}>
        줄을 누르면 일자별 입력과 AI 세션(어디서 수집됐고 왜 이 단계에 붙었는지)이 펼쳐집니다. 회색 줄은 확정되지 않아 집계에서 빠진 날입니다.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className={d.table}>
          <thead>
            <tr>
              <th>요구사항 · 단계</th>
              <th>담당</th>
              <th className={d.r}>등급 단가</th>
              <th className={d.r}>기준 M/D</th>
              <th className={d.r}>확정 공수</th>
              <th className={d.r}>투입 M/D</th>
              <th className={d.r}>측정 인건비</th>
              <th className={d.r}>AI 사용</th>
              <th className={d.r}>AI 비용</th>
            </tr>
          </thead>
          <tbody>
            {prjs.map(([prjId, prjNm]) => (
              <Fragment key={prjId}>
                <tr className={b.prj}>
                  <td colSpan={9}>{prjNm}</td>
                </tr>
                {units
                  .filter((u) => u.prjId === prjId)
                  .map((u) => {
                    const on = open.has(u.code);
                    const counted = u.days.filter((x) => x.counted);
                    return (
                      <Fragment key={u.code}>
                        <tr className={d.click} onClick={() => toggle(u.code)}>
                          <td>
                            <span className={d.caret}>{on ? "▾" : "▸"}</span>
                            <b>{u.reqName}</b> · {STAGE_LABEL[u.stage]}
                            <div className={d.sub} style={{ paddingLeft: 16 }}>
                              {u.code} · 입력 {u.days.length}일 / 집계 {counted.length}일
                            </div>
                          </td>
                          <td>{u.ownerNm}</td>
                          <td className={d.r}>
                            {u.grade} {man(u.price)}
                          </td>
                          <td className={d.r}>{f1(u.baseMd)}</td>
                          <td className={d.r}>{h2(u.tot)}h</td>
                          <td className={d.r}>{f1(u.tot / mdHours)}</td>
                          <td className={d.r}>{man((u.tot / mdHours) * u.price)}</td>
                          <td className={d.r}>{h2(counted.reduce((a, x) => a + x.inT, 0))}h</td>
                          <td className={d.r}>{man(counted.reduce((a, x) => a + x.aiCost, 0))}</td>
                        </tr>
                        {on && (
                          <tr>
                            <td colSpan={9} className={b.daysCell}>
                              <Days days={u.days} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className={b.note} style={{ padding: "12px 20px" }}>
        금액 단위 만원. 투입 M/D = 확정 공수 ÷ {mdHours}h, 측정 인건비 = 투입 M/D × 등급 단가.
      </p>
    </Panel>
  );
}

function Days({ days }: { days: BasisDayVM[] }) {
  if (!days.length) return <p className="subtle">입력이 없습니다.</p>;
  return (
    <table className={b.days}>
      <thead>
        <tr>
          <th>일자</th>
          <th>상태</th>
          <th className={b.r}>AI 수집</th>
          <th className={b.r}>줄임</th>
          <th className={b.r}>AI 사용</th>
          <th>AI 없이 한 일</th>
          <th className={b.r}>합계</th>
          <th>AI 세션 (출처 · 도구 · 시간 · 배정 근거)</th>
        </tr>
      </thead>
      <tbody>
        {days.map((x) => (
          <tr key={x.date} className={x.counted ? undefined : b.skip}>
            <td>{x.date}</td>
            <td>
              {ST[x.st] ?? x.st}
              {x.confirmedAt && <div className={b.tiny}>{x.confirmedAt.slice(0, 16).replace("T", " ")}</div>}
            </td>
            <td className={b.r}>{h2(x.ai)}</td>
            <td className={b.r}>{x.mn ? `−${h2(x.mn)}` : ""}</td>
            <td className={b.r}>{h2(x.inT)}</td>
            <td>
              {Object.entries(x.add)
                .filter(([, v]) => (v ?? 0) > 0)
                .map(([k, v]) => `${ACT_LABEL[k as ActType]} ${h2(v ?? 0)}`)
                .join(", ") || "—"}
              {x.memo && <div className={b.tiny}>메모: {x.memo}</div>}
            </td>
            <td className={b.r}>
              <b>{h2(x.tot)}</b>
            </td>
            <td>
              {x.sessions.length === 0
                ? "—"
                : x.sessions.map((s, i) => (
                    <div key={i} className={b.tiny}>
                      {SRC[s.src] ?? s.src} · {s.tool} · {s.start}
                      {s.end ? `~${s.end}` : ""} · {s.min}분 · {s.tokens ? `${s.tokens.toLocaleString()} 토큰 · ` : ""}
                      {s.cost === null ? "비용 빈칸" : won(s.cost)} · {s.how}
                    </div>
                  ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// 원장 전체를 일자 단위 한 줄씩 — 엑셀에서 피벗으로 다시 계산해 볼 수 있게.
function downloadCsv(vm: BasisVM) {
  const head = ["과제", "요구사항ID", "요구사항", "단계", "공수태그", "담당", "등급", "등급단가", "기준MD", "일자", "상태", "집계포함", "AI수집h", "줄임h", "AI사용h", "AI없이h", "합계h", "AI비용", "AI비용빈칸", "세션수"];
  const lines = [head];
  for (const u of vm.units)
    for (const x of u.days)
      lines.push([u.prjNm, u.reqId, u.reqName, STAGE_LABEL[u.stage], u.code, u.ownerNm, u.grade, String(u.price), String(u.baseMd), x.date, ST[x.st] ?? x.st, x.counted ? "Y" : "N", h2(x.ai), h2(x.mn), h2(x.inT), h2(x.out), h2(x.tot), String(Math.round(x.aiCost)), String(x.aiNa), String(x.sessions.length)]);

  const csv = "﻿" + lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `산출근거_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
