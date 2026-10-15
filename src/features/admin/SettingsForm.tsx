"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/apiClient";
import { ACT_TYPES, type Settings } from "@/lib/measure/types";
import { STAGE_LABEL, STAGES } from "@/lib/types";
import b from "../common/board.module.css";
import { useMutate } from "../common/useMutate";

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

export function SettingsForm({ initial }: { initial: Settings }) {
  const { run, busy } = useMutate();
  const [mdHours, setMdHours] = useState(String(initial.mdHours));
  const [start, setStart] = useState(initial.measureStart);
  const [grade, setGrade] = useState(Object.entries(initial.gradePrice).map(([k, v]) => [k, String(v)]));
  const [rates, setRates] = useState(Object.entries(initial.aiRate).map(([k, v]) => [k, String(v)]));
  const [defRate, setDefRate] = useState(String(initial.defaultAiRate));
  const [wt, setWt] = useState(Object.fromEntries(STAGES.map((cd) => [cd, (initial.workTypes[cd] ?? []).join("\n")])));

  function save() {
    const body: Settings = {
      mdHours: num(mdHours),
      measureStart: start,
      gradePrice: Object.fromEntries(grade.filter(([k]) => k.trim()).map(([k, v]) => [k.trim(), num(v)])),
      aiRate: Object.fromEntries(rates.filter(([k]) => k.trim()).map(([k, v]) => [k.trim(), num(v)])),
      defaultAiRate: num(defRate),
      workTypes: Object.fromEntries(STAGES.map((cd) => [cd, wt[cd].split("\n").map((x) => x.trim()).filter(Boolean)])) as Settings["workTypes"],
    };
    void run(() => api("/api/admin/settings", { method: "PUT", body }), "코드·단가를 저장했습니다. 측정 결과에 바로 반영됩니다.");
  }

  const pairTable = (rows: string[][], set: (r: string[][]) => void, keyHead: string, valHead: string, addable: boolean) => (
    <div className={b.tw}>
      <table className={b.tbl}>
        <thead>
          <tr>
            <th>{keyHead}</th>
            <th className="r">{valHead}</th>
            {addable && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i}>
              <td>{addable ? <input className={b.sel} value={k} onChange={(e) => set(rows.map((r, j) => (j === i ? [e.target.value, r[1]] : r)))} /> : k}</td>
              <td className="r">
                <input className={b.sel} type="number" min="0" step="1000" style={{ width: 120, textAlign: "right" }} value={v} onChange={(e) => set(rows.map((r, j) => (j === i ? [r[0], e.target.value] : r)))} />
              </td>
              {addable && (
                <td>
                  <Button size="sm" variant="ghost" onClick={() => set(rows.filter((_, j) => j !== i))}>
                    빼기
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className={b.grid2} style={{ marginTop: 0 }}>
        <section>
          <h3 className="h2" style={{ marginBottom: 8 }}>
            기간 · 환산
          </h3>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label className={b.small}>
              측정 시작일
              <br />
              <input className={b.sel} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className={b.small}>
              1 M/D = 시간
              <br />
              <input className={b.sel} type="number" min="1" step="0.5" style={{ width: 80 }} value={mdHours} onChange={(e) => setMdHours(e.target.value)} />
            </label>
          </div>
          <h3 className="h2" style={{ margin: "16px 0 8px" }}>
            등급별 M/D 단가 (원)
          </h3>
          {pairTable(grade, setGrade, "필요 개발자 등급 (REQ-05)", "M/D 단가", false)}
        </section>
        <section>
          <h3 className="h2" style={{ marginBottom: 8 }}>
            AI 도구별 시간당 비용 (원)
          </h3>
          {pairTable(rates, setRates, "AI 도구 (AIS-02 / 수집 도구명)", "시간당", true)}
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Button size="sm" icon="plus" onClick={() => setRates([...rates, ["", "0"]])}>
              도구 추가
            </Button>
            <span className={b.small}>
              목록에 없는 도구{" "}
              <input className={b.sel} type="number" min="0" step="1000" style={{ width: 110, textAlign: "right" }} value={defRate} onChange={(e) => setDefRate(e.target.value)} /> 원/시간
            </span>
          </div>
        </section>
      </div>

      <section>
        <h3 className="h2" style={{ marginBottom: 8 }}>
          SDLC 단계 · 업무 유형 <span className={b.xs}>(한 줄에 하나 · 요구사항 편집의 선택지)</span>
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {STAGES.map((cd) => (
            <label key={cd} className={b.small}>
              <b>{STAGE_LABEL[cd]}</b> <span className={b.xs}>{cd}</span>
              <textarea className={b.sel} rows={5} style={{ width: "100%", resize: "vertical" }} value={wt[cd]} onChange={(e) => setWt({ ...wt, [cd]: e.target.value })} />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="h2" style={{ marginBottom: 8 }}>
          AI 도구 외 작업 유형 <span className={b.xs}>(고정 — 측정 중 바꾸면 입력값의 의미가 달라짐)</span>
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "4px 16px" }} className={b.small}>
          {ACT_TYPES.map((a) => (
            <div key={a.cd}>
              <b>
                {a.cd} {a.label}
              </b>{" "}
              <span className={b.xs}>{a.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <div>
        <Button variant="primary" loading={busy} onClick={save}>
          저장
        </Button>
      </div>
    </div>
  );
}
