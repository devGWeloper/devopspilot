"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { f1, pct } from "@/lib/format";
import { fmtDay } from "@/lib/labels";
import type { Ratio } from "@/lib/measure/metrics";
import type { CollectRowVM, ConfMatrixVM } from "@/lib/views";
import b from "../common/board.module.css";
import { HistoryView } from "./history/HistoryView";

type Tab = "conf" | "collect" | "history";

const won = (v: number) => `${Math.round(v).toLocaleString()}원`;
const ratioText = (r: Ratio) => (r.rate === null ? "—" : `${pct(r.rate)} (${r.num}/${r.den})`);

export function AdminTabs({ conf, collect, otelOn }: { conf: ConfMatrixVM; collect: CollectRowVM[]; otelOn: boolean }) {
  const [tab, setTab] = useState<Tab>("conf");
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="시스템 관리"
        description={
          <>
            개발자 확정 현황과 Codex 사용 수집 상태, 변경 이력입니다. 계정·단가·요구사항은 <Link href="/master">기준 데이터</Link>에서 관리합니다.
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "conf", label: "확정 현황" },
          { key: "collect", label: "수집 현황" },
          { key: "history", label: "변경 이력" },
        ]}
      />
      <div style={{ marginTop: 16 }}>
        {tab === "history" && <HistoryView />}
        {tab === "conf" && <ConfMatrix vm={conf} />}
        {tab === "collect" && <CollectLog rows={collect} otelOn={otelOn} />}
      </div>
    </>
  );
}

function ConfMatrix({ vm }: { vm: ConfMatrixVM }) {
  return (
    <>
      <p className={b.note} style={{ marginBottom: 8 }}>
        개발자 × 일자 확정 상태 · 숫자 = 확정이 필요한 요구사항 수 · ✓ = 모두 확정 · · = 입력 없음 · 다음 날 확정률 = 다음 영업일 23:59 까지 처음 확정한 날 ÷ 기록이 있는 날 (전체{" "}
        <b>{ratioText(vm.nextDay)}</b>)
      </p>
      <div className={b.tw}>
        <table className={b.tbl}>
          <thead>
            <tr>
              <th>개발자</th>
              {vm.days.map((d) => (
                <th key={d} className="c">
                  {fmtDay(d)}
                </th>
              ))}
              <th className="r">확정률</th>
              <th className="r">다음 날 확정률</th>
            </tr>
          </thead>
          <tbody>
            {vm.rows.map((r) => (
              <tr key={r.userId}>
                <td>
                  <b>{r.userNm}</b> <span className={b.xs}>{r.userId}</span>
                </td>
                {r.cells.map((n, i) => (
                  <td key={i} className="c">
                    {n === null ? <span className="subtle">·</span> : n > 0 ? <b className={b.warn}>{n}</b> : "✓"}
                  </td>
                ))}
                <td className="r">{pct(r.rate)}</td>
                <td className="r">{ratioText(r.nextDay)}</td>
              </tr>
            ))}
            {vm.rows.length === 0 && (
              <tr>
                <td colSpan={vm.days.length + 3} className="muted">
                  개발자 계정이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CollectLog({ rows, otelOn }: { rows: CollectRowVM[]; otelOn: boolean }) {
  return (
    <>
      <p className={b.note} style={{ marginBottom: 8 }}>
        텔레메트리 수신 {otelOn ? "켜짐" : <b className={b.warn}>꺼짐 — config.yml 의 collect.token 을 넣어야 받습니다</b>} · 개발자 × 일자 × 출처별 Codex 세션 · 태그 = 공수 태그로 자동 배정된 시간 · 미배정 = 아직
        &apos;확인 필요&apos;에 남은 세션 · 비용 빈칸 = 토큰 미수집 또는 단가 없는 모델
      </p>
      <div className={b.tw}>
        <table className={b.tbl}>
          <thead>
            <tr>
              <th>일자</th>
              <th>개발자</th>
              <th>출처</th>
              <th className="r">세션</th>
              <th className="r">시간 (h)</th>
              <th className="r">태그 (h)</th>
              <th className="r">미배정</th>
              <th className="r">토큰</th>
              <th className="r">AI 비용</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.userId}|${r.date}|${r.src}`}>
                <td>{fmtDay(r.date)}</td>
                <td>{r.userNm}</td>
                <td>{r.src === "OTEL" ? "텔레메트리" : "로그 업로드"}</td>
                <td className="r">{r.sessions}</td>
                <td className="r">{f1(r.minutes / 60)}</td>
                <td className="r">{f1(r.tagged / 60)}</td>
                <td className="r">{r.pending ? <b className={b.warn}>{r.pending}</b> : 0}</td>
                <td className="r">{r.tokens ? r.tokens.toLocaleString() : "—"}</td>
                <td className="r">
                  {r.cost === null ? "—" : won(r.cost)}
                  {r.cost !== null && r.costNa > 0 && <span className={b.xs}> (빈칸 {r.costNa})</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  수집된 AI 사용 기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
