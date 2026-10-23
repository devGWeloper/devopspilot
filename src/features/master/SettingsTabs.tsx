"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import type { MetricDef } from "@/lib/measure/metrics";
import type { Settings } from "@/lib/measure/types";
import b from "../common/board.module.css";
import { SettingsForm } from "./SettingsForm";

type Tab = "base" | "logic";

export function SettingsTabs({ settings, metrics }: { settings: Settings; metrics: MetricDef[] }) {
  const [tab, setTab] = useState<Tab>("base");
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="단가·기준정보"
        description="인건비·토큰 단가, 1 M/D 시간, 업무 유형 등 측정 계산에 쓰는 값입니다. 바꾸면 과거 값까지 다시 계산됩니다. 엑셀 '04. 기준정보' 시트로도 올릴 수 있습니다."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "base", label: "기준정보" },
          { key: "logic", label: "집계 로직" },
        ]}
      />
      <div style={{ marginTop: 16 }}>
        {tab === "base" && <SettingsForm initial={settings} />}
        {tab === "logic" && <Logic metrics={metrics} />}
      </div>
    </>
  );
}

function Logic({ metrics }: { metrics: MetricDef[] }) {
  return (
    <>
      <p className={b.note} style={{ marginBottom: 8 }}>
        &apos;05. 주요 집계 로직&apos; 시트 그대로입니다. 측정 결과 화면의 숫자는 모두 이 산식으로 계산합니다(확정된 날만). 오른쪽 열은 엑셀 문구로 정해지지 않는 포털 기준입니다.
      </p>
      <div className={b.tw}>
        <table className={b.tbl}>
          <thead>
            <tr>
              <th>구분</th>
              <th>지표</th>
              <th>상세 로직 (입력 데이터.항목 기준)</th>
              <th>포털 기준</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.key}>
                <td>{m.group}</td>
                <td>
                  <b>{m.name}</b>
                </td>
                <td>{m.formula}</td>
                <td className={b.xs}>{m.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
