import { STAGE_LABEL, type StageCd } from "../types";

/**
 * 단계별 Codex 사용법. AI 에게 "해 줘" 한 번이면 분석·설계·개발이 한 세션에 섞여 단계별 효과를 잴 수 없으므로,
 * 세션 하나에 단계 하나만 시키고 단계 사이는 산출 문서로 잇는다.
 * 파일명에 다른 단계 코드(…-AN 등)를 넣지 않는다 — 다음 단계 세션에서 그 경로를 말하면 단계 코드가 둘이 되어 미분류로 빠진다.
 */
export interface StageGuide {
  /** 이 세션에서 할 일 */
  goal: string;
  /** 하지 말 일 — 다음 단계 일이 섞이지 않게 */
  stop: string;
  /** 앞 단계에서 받아 읽을 문서 */
  input: string[];
  /** 이 단계 산출 문서 */
  output: string;
  /** 산출 문서에 담을 항목 */
  sections: string[];
}

export const STAGE_GUIDE: Record<StageCd, StageGuide> = {
  AN: {
    goal: "요구사항을 파악하고 관련된 현행 소스·화면·테이블·데이터를 찾아 분석",
    stop: "설계안이나 코드는 만들지 마세요.",
    input: [],
    output: "01_분석.md",
    sections: ["요구사항 요약과 범위", "영향 받는 소스·화면·테이블", "현행 처리 흐름", "확인이 필요한 사항"],
  },
  DS: {
    goal: "분석 문서를 바탕으로 화면·테이블·인터페이스·처리 흐름을 설계",
    stop: "코드는 수정하지 마세요.",
    input: ["01_분석.md"],
    output: "02_설계.md",
    sections: ["화면·테이블·인터페이스 변경 내용", "처리 흐름", "변경할 파일 목록", "테스트 관점"],
  },
  DV: {
    goal: "설계 문서대로 구현하고 단위 테스트 작성",
    stop: "설계와 다르게 해야 하면 바꾸기 전에 이유를 먼저 말해 주세요.",
    input: ["02_설계.md"],
    output: "03_개발.md",
    sections: ["변경한 파일과 주요 변경 내용", "단위 테스트와 결과"],
  },
  TS: {
    goal: "분석·설계·개발 문서를 읽고 테스트 케이스를 만들어 실행, 결함은 원인과 조치까지",
    stop: "새 기능은 추가하지 마세요.",
    input: ["01_분석.md", "02_설계.md", "03_개발.md"],
    output: "04_테스트.md",
    sections: ["테스트 케이스와 결과", "결함·원인·조치"],
  },
};

/** 요구사항별 산출 문서 폴더 — 저장소 안에 두어 다음 단계 세션이 읽을 수 있게 */
export const docDir = (reqKey: string) => `docs/poc/${reqKey}`;

/** Codex 세션 첫 메시지로 붙여 넣는 지시문. 첫 줄 `poc 공수태그` 로 시간이 이 단계에 붙는다. */
export function stagePrompt(p: { code: string; reqKey: string; name: string; stage: StageCd }): string {
  const g = STAGE_GUIDE[p.stage];
  const dir = docDir(p.reqKey);
  const label = STAGE_LABEL[p.stage];
  const lines = [
    `poc ${p.code}`,
    `[${label} 단계] ${p.reqKey}${p.name && p.name !== p.reqKey ? ` ${p.name}` : ""}`,
    `이 세션에서는 '${label}'만 합니다. ${g.stop}`,
    "",
    ...(g.input.length ? [`1. ${g.input.map((f) => `${dir}/${f}`).join(", ")} 를 먼저 읽어 주세요. 없으면 진행하지 말고 알려 주세요.`] : []),
    `${g.input.length ? 2 : 1}. ${g.goal}해 주세요.`,
    `${g.input.length ? 3 : 2}. 결과를 ${dir}/${g.output} 로 저장해 주세요. 담을 내용: ${g.sections.join(" / ")}`,
  ];
  if (p.stage === "AN") lines.push("", "요구사항 내용:", "(여기에 요구사항 설명·화면·관련 소스 위치를 붙여 넣으세요)");
  return lines.join("\n");
}

/**
 * 저장소 AGENTS.md 에 넣을 규칙 — Codex 가 매 세션 읽으므로 개발자가 지시문을 빠뜨려도 단계를 넘지 않게 한다.
 * AGENTS.md 는 세션 기록에 사용자 메시지로 들어가 태그 후보 추출 대상이 되므로, 숫자가 든 예시 코드·업무 외 표시를 그대로 넣지 않는다.
 */
export function agentsMd(): string {
  return [
    "## AI 활용 생산성 향상 PoC — 작업 규칙",
    "",
    "- 대화 첫 줄의 `poc <과제ID-요구사항ID-단계>` 가 이 세션의 범위다. 단계: AN 분석 · DS 설계 · DV 개발 · TS 테스트.",
    "- 이 세션에서는 그 단계 일만 한다. 다른 단계 일을 요청받으면 진행하지 말고 \"새 세션에서 그 단계 지시문으로 시작해 주세요\"라고 답한다.",
    ...(Object.keys(STAGE_GUIDE) as StageCd[]).map((cd) => {
      const g = STAGE_GUIDE[cd];
      const read = g.input.length ? `${g.input.join(", ")} 를 먼저 읽고 ` : "";
      return `  - ${cd} ${STAGE_LABEL[cd]}: ${read}${g.goal}. ${g.stop} 결과는 ${docDir("<과제ID-요구사항ID>")}/${g.output}`;
    }),
    "- 앞 단계 문서가 없으면 진행하지 말고 알린다.",
    "- 산출 문서 파일 이름에 단계 코드를 넣지 않는다.",
    // `poc off` 를 그대로 적으면 모든 세션이 업무 외 표시를 단 것으로 읽힌다.
    "- 첫 줄이 업무 외 표시(poc 뒤에 off)인 세션은 PoC 와 무관한 일이다.",
  ].join("\n");
}
