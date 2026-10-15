"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { f1, pct } from "@/lib/format";
import { fmtDay } from "@/lib/labels";
import type { Settings } from "@/lib/measure/types";
import type { CollectRowVM, ConfMatrixVM } from "@/lib/views";
import b from "../common/board.module.css";
import { HistoryView } from "./history/HistoryView";
import { SettingsForm } from "./SettingsForm";
import { UsersAdmin } from "./users/UsersAdmin";

type Tab = "users" | "conf" | "collect" | "history" | "codes";

export function AdminTabs({ conf, collect, settings, otelOn }: { conf: ConfMatrixVM; collect: CollectRowVM[]; settings: Settings; otelOn: boolean }) {
  const [tab, setTab] = useState<Tab>("conf");
  return (
    <>
      <div className={b.head}>
        <h1 className={b.title}>시스템 관리</h1>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "conf", label: "확정 현황" },
          { key: "collect", label: "수집 현황" },
          { key: "users", label: "계정" },
          { key: "codes", label: "코드·단가" },
          { key: "history", label: "변경 이력" },
        ]}
      />
      <div style={{ marginTop: 16 }}>
        {tab === "users" && <UsersAdmin />}
        {tab === "history" && <HistoryView />}
        {tab === "codes" && <SettingsForm initial={settings} />}
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
        개발자 × 일자 확정 상태 · 숫자 = 확정이 필요한 요구사항 수 · ✓ = 모두 확정 · · = 입력 없음
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
              </tr>
            ))}
            {vm.rows.length === 0 && (
              <tr>
                <td colSpan={vm.days.length + 2} className="muted">
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
        텔레메트리 수신 {otelOn ? "켜짐" : <b className={b.warn}>꺼짐 — config.yml 의 collect.token 을 넣어야 받습니다</b>} · 개발자 × 일자 × 출처별 수집 세션 · 미배정 = 아직 &apos;확인 필요&apos;에 남은 세션
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
              <th className="r">미배정</th>
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
                <td className="r">{r.pending ? <b className={b.warn}>{r.pending}</b> : 0}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
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
