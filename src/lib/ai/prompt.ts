import type { BalanceReport } from "../balance";
import { evaluateFit, FIT_LABEL, highRuleLabel } from "../fitness";
import type { Codes, Criteria, Project } from "../types";

// 컨설턴트가 채우는 빈 틀. 앱은 판정 기준을 정하지 않는다.
export const PROMPT_TEMPLATE = `## 판정 기준 (상/중/하가 무엇인가)
예) 상: AI 가 표준 패턴을 그대로 재현할 수 있고 결과를 자동으로 검증할 수 있는 과제
    중: …
    하: …

## Major 지표 해석
예) '맥락 주입 가능성'이 어려움이면 다른 지표가 좋아도 AI 가 만든 결과를 믿기 어려우므로 하로 본다.

## 선정 원칙
예) 생산성 효과가 과대평가되지 않도록 상·중·하를 고르게 뽑는다. 레거시 과제를 최소 1건 포함한다.

## 주의사항
예) WBS 실적이 없으면 Replay 결과와 비교할 기준 공수가 없다.
`;

const OUTPUT_SPEC = `반드시 아래 JSON 하나만 출력하라. 다른 설명은 쓰지 마라.
{
  "grade": "상" | "중" | "하",
  "summary": "판정 근거 요약 (3문장 이내)",
  "strengths": ["Replay 에 유리한 점"],
  "risks": ["측정을 왜곡하거나 Replay 를 어렵게 하는 위험"],
  "indicatorComments": [{ "indicatorId": "지표 id", "comment": "지표별 의견" }],
  "replayNotes": "Replay 수행 시 유의사항",
  "balanceNote": "현재 선정 분포를 고려한 의견"
}`;

export function buildAssessPrompt(args: { consultantPrompt: string; criteria: Criteria; project: Project; balance: BalanceReport; codes: Codes }): { system: string; user: string } {
  const { consultantPrompt, criteria: c, project: p, balance, codes } = args;
  if (!consultantPrompt?.trim()) throw new Error("컨설턴트 프롬프트가 비어 있습니다.");

  const system = [
    "너는 SK hynix 의 'AI 활용 생산성 향상 PoC' 에서 Replay 테스트 대상 과제의 적합도를 판정하는 평가자다.",
    "Replay 테스트: AI 없이 완료된 과제의 일부 기능을, 당시 확정된 요구정의서·설계서·테스트케이스를 그대로 써서 AI 로 다시 개발하고 기존 실적과 비교한다.",
    "아래 컨설턴트 기준을 최우선으로 따르라.",
    "",
    consultantPrompt.trim(),
    "",
    OUTPUT_SPEC,
  ].join("\n");

  const label = (list: { code: string; label: string }[], code: string | null) => list.find((x) => x.code === code)?.label ?? code ?? "—";
  const criteriaText = c.areas
    .map(
      (a) =>
        `[${a.name}] ${a.question}\n` +
        a.indicators.map((i) => `  - ${i.id} ${i.name} (${i.tier}): ${i.options.map((o) => `${o.label}=${FIT_LABEL[o.level]}`).join(", ")}`).join("\n"),
    )
    .join("\n");
  const r = c.rule;
  const ev = evaluateFit(c, p.eval.answers);
  const answers = c.areas
    .flatMap((a) => a.indicators)
    .map((i) => {
      const o = i.options.find((x) => x.id === p.eval.answers[i.id]);
      const note = p.eval.notes[i.id] ? ` (메모: ${p.eval.notes[i.id]})` : "";
      return `- ${i.name}: ${o ? `${o.label} [${FIT_LABEL[o.level]}]` : "미응답"}${note}`;
    })
    .join("\n");
  const bl = p.base.baseline;
  const dist = `선정 ${balance.selectedCount}건 · 상 ${balance.byFit.H} / 중 ${balance.byFit.M} / 하 ${balance.byFit.L}` + (balance.warnings.length ? `\n부족: ${balance.warnings.map((w) => w.message).join("; ")}` : "");

  const user = [
    `## 평가 기준 v${c.version}`,
    criteriaText,
    `판정 규칙: Major 중 하 ${r.lowMinMajorLow}개 이상 → 하 / 하 ${r.highMaxMajorLow}개 이하이고 상 ${highRuleLabel(r)} 이상 → 상 / 그 외 중`,
    "",
    `## 대상 과제 ${p.prjId} ${p.prjNm}`,
    `시스템: ${p.sysNm} · 담당: ${label(codes.domains, p.base.domainCd)} ${p.base.orgNm} · 배포 형식: ${label(codes.sysTypes, p.base.sysTypeCd)} · 과제 영역: ${label(codes.workAreas, p.base.workAreaCd)} · 등급: ${label(codes.sysGrades, p.base.sysGradeCd)} · 언어: ${p.base.langCds.map((l) => label(codes.langs, l)).join(", ")}`,
    `AI 적용 계획: ${label(codes.llmTypes, p.base.llmTypeCd)} · ${label(codes.aiTools, p.base.aiToolCd)} · 계정 ${p.base.aiAccounts ?? "?"}개`,
    `설명: ${p.base.description || "—"}`,
    `원 프로젝트 실적: ${bl.startDate ?? "?"} ~ ${bl.endDate ?? "?"}, 총 ${bl.totalMm ?? "?"} M/M`,
    "",
    "## 지표 응답",
    answers,
    `규칙 기반 참고 등급: ${FIT_LABEL[ev.suggest]} (${ev.ruleText}${ev.bottleneck.length ? ` · 병목: ${ev.bottleneck.join(", ")}` : ""})`,
    `PM 예상 기대효과: ${p.base.pmFit ? FIT_LABEL[p.base.pmFit] : "미입력"}${p.base.pmFitReason ? ` — ${p.base.pmFitReason}` : ""}`,
    "",
    "## 현재 선정 분포",
    dist,
  ].join("\n");

  return { system, user };
}
