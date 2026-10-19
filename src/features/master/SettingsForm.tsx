"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/apiClient";
import { ACT_TYPES, type Settings } from "@/lib/measure/types";
import { STAGE_LABEL, STAGES } from "@/lib/types";
import b from "../common/board.module.css";
import { useMutate } from "../common/useMutate";

const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(/,/g, "")));
const s = (v: number | undefined) => (v === undefined || v === null ? "" : String(v));

export function SettingsForm({ initial }: { initial: Settings }) {
  const { run, busy } = useMutate();
  const [mdHours, setMdHours] = useState(String(initial.mdHours));
  const [start, setStart] = useState(initial.measureStart);
  const grades0 = Array.from(new Set([...Object.keys(initial.gradePrice), ...Object.keys(initial.gradePriceMm)]));
  const [grade, setGrade] = useState(grades0.map((g) => [g, s(initial.gradePriceMm[g] || undefined), s(initial.gradePrice[g])]));
  const [tokens, setTokens] = useState(Object.entries(initial.tokenPrice).map(([m, p]) => [m, s(p.input), s(p.cached), s(p.output)]));
  const [wt, setWt] = useState(Object.fromEntries(STAGES.map((cd) => [cd, (initial.workTypes[cd] ?? []).join("\n")])));

  function save() {
    const body: Settings = {
      mdHours: num(mdHours),
      measureStart: start,
      gradePrice: Object.fromEntries(grade.filter(([k]) => k.trim()).map(([k, , md]) => [k.trim(), num(md)])),
      gradePriceMm: Object.fromEntries(grade.filter(([k]) => k.trim()).map(([k, mm]) => [k.trim(), mm.trim() ? num(mm) : 0])),
      tokenPrice: Object.fromEntries(tokens.filter(([m]) => m.trim()).map(([m, i, c, o]) => [m.trim(), { input: num(i), cached: c.trim() ? num(c) : 0, output: num(o) }])),
      workTypes: Object.fromEntries(STAGES.map((cd) => [cd, wt[cd].split("\n").map((x) => x.trim()).filter(Boolean)])) as Settings["workTypes"],
    };
    void run(() => api("/api/admin/settings", { method: "PUT", body }), "기준정보를 저장했습니다. 측정 결과에 바로 반영됩니다.");
  }

  const cell = (rows: string[][], set: (r: string[][]) => void, i: number, j: number, w = 120, text = false) => (
    <input
      className={b.sel}
      type={text ? "text" : "number"}
      min="0"
      style={{ width: w, textAlign: text ? "left" : "right" }}
      value={rows[i][j]}
      onChange={(e) => set(rows.map((r, k) => (k === i ? r.map((x, l) => (l === j ? e.target.value : x)) : r)))}
    />
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className={b.grid2} style={{ marginTop: 0 }}>
        <section>
          <h3 className="h2" style={{ marginBottom: 8 }}>
            인건비 단가 표 <span className={b.xs}>(계산은 원/MD · 원/MM 은 참고)</span>
          </h3>
          <div className={b.tw}>
            <table className={b.tbl}>
              <thead>
                <tr>
                  <th>등급</th>
                  <th className="r">단가(원/MM)</th>
                  <th className="r">단가(원/MD)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {grade.map((r, i) => (
                  <tr key={i}>
                    <td>{cell(grade, setGrade, i, 0, 90, true)}</td>
                    <td className="r">{cell(grade, setGrade, i, 1, 130)}</td>
                    <td className="r">{cell(grade, setGrade, i, 2, 120)}</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => setGrade(grade.filter((_, k) => k !== i))}>
                        빼기
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="sm" icon="plus" style={{ marginTop: 8 }} onClick={() => setGrade([...grade, ["", "", ""]])}>
            등급 추가
          </Button>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
            <label className={b.small}>
              측정 시작일
              <br />
              <input className={b.sel} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className={b.small}>
              1 M/D = 시간 <span className={b.xs}>(= {Number(mdHours) * 60 || "—"}분)</span>
              <br />
              <input className={b.sel} type="number" min="1" step="0.5" style={{ width: 80 }} value={mdHours} onChange={(e) => setMdHours(e.target.value)} />
            </label>
          </div>
        </section>
        <section>
          <h3 className="h2" style={{ marginBottom: 8 }}>
            토큰 단가 표 <span className={b.xs}>(원 / 100만 토큰 · Codex 모델명 그대로)</span>
          </h3>
          <div className={b.tw}>
            <table className={b.tbl}>
              <thead>
                <tr>
                  <th>모델</th>
                  <th className="r">입력</th>
                  <th className="r">캐시 입력</th>
                  <th className="r">출력</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tokens.map((r, i) => (
                  <tr key={i}>
                    <td>{cell(tokens, setTokens, i, 0, 140, true)}</td>
                    <td className="r">{cell(tokens, setTokens, i, 1, 90)}</td>
                    <td className="r">{cell(tokens, setTokens, i, 2, 90)}</td>
                    <td className="r">{cell(tokens, setTokens, i, 3, 90)}</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => setTokens(tokens.filter((_, k) => k !== i))}>
                        빼기
                      </Button>
                    </td>
                  </tr>
                ))}
                {tokens.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      단가가 없습니다 — AI 비용은 빈칸으로 보이고 순절감 계산에서 0 으로 더합니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Button size="sm" icon="plus" style={{ marginTop: 8 }} onClick={() => setTokens([...tokens, ["", "", "", ""]])}>
            모델 추가
          </Button>
          <p className={b.xs} style={{ marginTop: 8 }}>
            AI 비용 = (입력 − 캐시) × 입력 + 캐시 × 캐시 입력 + 출력 × 출력. 단가가 없는 모델을 쓴 세션은 비용 빈칸입니다.
          </p>
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
