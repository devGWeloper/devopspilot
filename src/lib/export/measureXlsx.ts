import ExcelJS from "exceljs";
import { CAVEATS } from "../measure/caveats";
import { toCsv } from "../measure/csv";
import { aiCostOf } from "../measure/metrics";
import { isPostFix } from "../measure/postfix";
import { PHASE_LABEL, PHASES, type MeasureInput, type MetricSet, type MetricsResult } from "../measure/types";


const HEAD = "FF14213D";

function header(ws: ExcelJS.Worksheet, cols: { header: string; key: string; width: number }[]) {
  ws.columns = cols;
  const r = ws.getRow(1);
  r.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

const r2 = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 1000);

function setRow(scope: string, key: string, m: MetricSet) {
  return {
    scope,
    key,
    n: m.featureCount,
    done: m.doneCount,
    ref: m.reference ? "참고값" : "",
    hpf: r2(m.hoursPerFeature),
    saving: r2(m.savingRate),
    design: r2(m.phaseSaving.DESIGN),
    dev: r2(m.phaseSaving.DEV),
    unit: r2(m.phaseSaving.UNIT),
    aiCost: Math.round(m.aiCost),
    req: m.aiRequests,
    cpf: m.costPerFeature === null ? null : Math.round(m.costPerFeature),
    diff: m.costDiffPerFeature === null ? null : Math.round(m.costDiffPerFeature),
    defA: r2(m.defectRateA),
    defB: r2(m.defectRateB),
    postfix: r2(m.postFixRate),
  };
}

export async function buildMeasureWorkbook(input: MeasureInput, result: MetricsResult, projects: { prjId: string; prjNm: string }[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AI 활용 생산성 향상 PoC 포털";
  const st = input.settings;
  const types = Object.fromEntries(st.featureTypes.map((t) => [t.code, t.label]));
  const pname = (id: string) => projects.find((p) => p.prjId === id)?.prjNm ?? id;

  const sum = wb.addWorksheet("지표 요약");
  header(sum, [
    { header: "구분", key: "scope", width: 10 },
    { header: "대상", key: "key", width: 26 },
    { header: "기능 수", key: "n", width: 8 },
    { header: "완료", key: "done", width: 7 },
    { header: "비고", key: "ref", width: 8 },
    { header: "기능당 투입시간(h)", key: "hpf", width: 14 },
    { header: "공수 절감률", key: "saving", width: 11 },
    { header: "절감률-상세설계", key: "design", width: 13 },
    { header: "절감률-개발", key: "dev", width: 11 },
    { header: "절감률-단위테스트", key: "unit", width: 14 },
    { header: "AI 비용(원)", key: "aiCost", width: 12 },
    { header: "AI 요청 수", key: "req", width: 10 },
    { header: "기능당 총비용(원)", key: "cpf", width: 15 },
    { header: "기능당 비용 차이(원)", key: "diff", width: 16 },
    { header: "결함률 A", key: "defA", width: 9 },
    { header: "결함률 B", key: "defB", width: 9 },
    { header: "사후 수정률", key: "postfix", width: 11 },
  ]);
  sum.addRow(setRow("전체", "전체", result.overall));
  for (const [k, m] of Object.entries(result.byProject)) sum.addRow(setRow("과제", `${k} ${pname(k)}`, m));
  for (const [k, m] of Object.entries(result.byType)) sum.addRow(setRow("유형", types[k] ?? k, m));
  for (const [k, m] of Object.entries(result.byTypeSize)) {
    const [t, sz] = k.split("|");
    sum.addRow(setRow("유형×규모", `${types[t] ?? t} · ${sz}`, m));
  }
  for (const k of ["saving", "design", "dev", "unit", "postfix"]) sum.getColumn(k).numFmt = "0.0%";
  for (const k of ["aiCost", "cpf", "diff"]) sum.getColumn(k).numFmt = "#,##0";
  sum.addRow([]);
  sum.addRow([`인건비 단가 ${st.laborRatePerHour.toLocaleString()}원/h · 사후 수정 판정 ${st.postFixDays}일 · 측정 단계 ${PHASES.filter((p) => st.phases[p]).map((p) => PHASE_LABEL[p]).join("·")}${st.sampleValues ? " · ※ 단가는 예시값" : ""}`]);

  const on = PHASES.filter((p) => st.phases[p]);
  const led = wb.addWorksheet("공수 기록표");
  header(led, [
    { header: "과제", key: "prj", width: 10 },
    { header: "WBS-ID", key: "wbs", width: 12 },
    { header: "기능명", key: "nm", width: 26 },
    { header: "유형", key: "type", width: 14 },
    { header: "규모", key: "size", width: 6 },
    { header: "기존 실적 A(h)", key: "a", width: 13 },
    ...on.map((p) => ({ header: `${PHASE_LABEL[p]} B(h)`, key: `b_${p}`, width: 13 })),
    { header: "완료일", key: "done", width: 11 },
    { header: "Replay B(h)", key: "b", width: 11 },
    { header: "절감률", key: "saving", width: 9 },
    { header: "근거 확인", key: "ev", width: 9 },
  ]);
  for (const fm of result.byFeature) {
    led.addRow({
      prj: fm.feature.prjId,
      wbs: fm.feature.wbsId,
      nm: fm.feature.name,
      type: types[fm.feature.typeCd] ?? fm.feature.typeCd,
      size: fm.size + (fm.sizeOutOfRange ? "*" : ""),
      a: fm.a,
      ...Object.fromEntries(on.map((p) => [`b_${p}`, fm.bByPhase[p]])),
      done: fm.feature.completedAt ?? "",
      b: fm.b,
      saving: fm.savingRate,
      ev: fm.feature.baseline.evidenceVerified ? "Y" : "N",
    });
  }
  led.getColumn("saving").numFmt = "0.0%";
  led.addRow({ nm: "완료 기능 합계", a: result.overall.sumA, b: result.overall.sumB, saving: result.overall.savingRate }).font = { bold: true };

  const eff = wb.addWorksheet("공수 기록");
  header(eff, [
    { header: "과제", key: "prj", width: 10 },
    { header: "WBS-ID", key: "wbs", width: 12 },
    { header: "작업일", key: "dt", width: 11 },
    { header: "단계", key: "ph", width: 11 },
    { header: "투입시간(h)", key: "h", width: 11 },
    { header: "작성자", key: "u", width: 10 },
    { header: "AI 활용", key: "ai", width: 9 },
    { header: "출처", key: "src", width: 8 },
  ]);
  for (const e of [...input.efforts].sort((a, b) => a.workDt.localeCompare(b.workDt))) {
    eff.addRow({ prj: e.prjId, wbs: e.wbsId, dt: e.workDt, ph: PHASE_LABEL[e.phase], h: e.hours, u: e.userId, ai: e.aiLevel ?? "", src: e.srcCd === "GRID" ? "보정" : "기록" });
  }

  const def = wb.addWorksheet("결함");
  header(def, [
    { header: "과제", key: "prj", width: 10 },
    { header: "결함 ID", key: "id", width: 10 },
    { header: "WBS-ID", key: "wbs", width: 12 },
    { header: "제목", key: "t", width: 36 },
    { header: "심각도", key: "sev", width: 8 },
    { header: "발견 단계", key: "ph", width: 11 },
    { header: "발견일", key: "dt", width: 11 },
    { header: "원인", key: "c", width: 20 },
    { header: "출처", key: "src", width: 8 },
  ]);
  for (const d of input.defects) def.addRow({ prj: d.prjId, id: d.defectId, wbs: d.wbsId, t: d.title, sev: d.severity === "CRITICAL" ? "치명" : "일반", ph: PHASE_LABEL[d.phase], dt: d.foundDt, c: d.cause, src: d.srcCd === "JIRA" ? "Jira" : "수기" });

  const use = wb.addWorksheet("AI 사용량");
  header(use, [
    { header: "과제", key: "prj", width: 10 },
    { header: "일자", key: "dt", width: 11 },
    { header: "개발자", key: "u", width: 10 },
    { header: "WBS-ID", key: "wbs", width: 12 },
    { header: "모델", key: "m", width: 20 },
    { header: "요청 수", key: "r", width: 8 },
    { header: "입력", key: "i", width: 11 },
    { header: "출력", key: "o", width: 11 },
    { header: "캐시 읽기", key: "cr", width: 11 },
    { header: "캐시 쓰기", key: "cw", width: 11 },
    { header: "추정 비용(원)", key: "cost", width: 12 },
    { header: "출처", key: "src", width: 9 },
  ]);
  for (const u of input.usages) {
    use.addRow({ prj: u.prjId, dt: u.workDt, u: u.userId, wbs: u.wbsId ?? "(미상)", m: u.model, r: u.requests, i: u.inputTokens, o: u.outputTokens, cr: u.cacheReadTokens, cw: u.cacheWriteTokens, cost: Math.round(aiCostOf(u, st.tokenPrices) ?? 0), src: u.srcCd });
  }

  const cm = wb.addWorksheet("커밋");
  header(cm, [
    { header: "과제", key: "prj", width: 10 },
    { header: "해시", key: "h", width: 10 },
    { header: "일자", key: "dt", width: 11 },
    { header: "작성자", key: "a", width: 12 },
    { header: "WBS-ID", key: "wbs", width: 12 },
    { header: "메시지", key: "msg", width: 40 },
    { header: "추가", key: "add", width: 7 },
    { header: "삭제", key: "del", width: 7 },
    { header: "사후 수정", key: "pf", width: 9 },
  ]);
  for (const c of [...input.commits].sort((a, b) => a.workDt.localeCompare(b.workDt))) {
    const f = input.features.find((x) => x.prjId === c.prjId && x.wbsId === c.wbsId);
    cm.addRow({ prj: c.prjId, h: c.hash, dt: c.workDt, a: c.author, wbs: c.wbsId ?? "(규칙 위반)", msg: c.message, add: c.added, del: c.deleted, pf: f && isPostFix(c.workDt, f.completedAt, st.postFixDays) ? "Y" : "" });
  }

  const set = wb.addWorksheet("설정");
  set.columns = [{ width: 26 }, { width: 50 }];
  set.addRows([
    ["인건비 시간당 단가(원)", st.laborRatePerHour],
    ["사후 수정 판정 기간(일)", st.postFixDays],
    ["교차 검증 허용 오차(일)", st.crossCheckToleranceDays],
    ["측정 단계", on.map((p) => PHASE_LABEL[p]).join(", ")],
    ["1MD 환산(h)", st.mdHours],
    ["규모 구간(h)", `S < ${st.sizeBands.S} ≤ M < ${st.sizeBands.M} ≤ L (8h 미만·${st.sizeBands.L}h 초과는 * 표시)`],
    ["단가 예시값 여부", st.sampleValues ? "예시값 (확정 필요)" : "확정"],
    [],
    ["모델", "입력 / 출력 / 캐시 읽기 / 캐시 쓰기 (원 / 100만 토큰)"],
    ...st.tokenPrices.map((p) => [p.model, `${p.input} / ${p.output} / ${p.cacheRead} / ${p.cacheWrite}`]),
  ]);

  const cav = wb.addWorksheet("해석 주의사항");
  cav.getColumn(1).width = 110;
  CAVEATS.forEach((t, i) => (cav.addRow([`${i + 1}. ${t}`]).alignment = { wrapText: true }));

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export type RawKind = "efforts" | "defects" | "usages" | "commits";

export function rawCsv(input: MeasureInput, kind: RawKind): string {
  const rows: (string | number | null)[][] =
    kind === "efforts"
      ? [["prj_id", "wbs_id", "work_dt", "phase", "hours", "user_id", "ai_level", "source"], ...input.efforts.map((e) => [e.prjId, e.wbsId, e.workDt, e.phase, e.hours, e.userId, e.aiLevel, e.srcCd])]
      : kind === "defects"
        ? [["prj_id", "defect_id", "wbs_id", "found_dt", "phase", "severity", "title", "cause", "source"], ...input.defects.map((d) => [d.prjId, d.defectId, d.wbsId, d.foundDt, d.phase, d.severity, d.title, d.cause, d.srcCd])]
        : kind === "usages"
          ? [["prj_id", "date", "user", "wbs_id", "model", "requests", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "source"], ...input.usages.map((u) => [u.prjId, u.workDt, u.userId, u.wbsId, u.model, u.requests, u.inputTokens, u.outputTokens, u.cacheReadTokens, u.cacheWriteTokens, u.srcCd])]
          : [["prj_id", "hash", "date", "author", "wbs_id", "message", "added", "deleted"], ...input.commits.map((c) => [c.prjId, c.hash, c.workDt, c.author, c.wbsId, c.message, c.added, c.deleted])];
  // 엑셀에서 바로 열 때 한글이 깨지지 않도록 BOM 을 붙인다.
  return "﻿" + toCsv(rows);
}

export { CAVEATS };
