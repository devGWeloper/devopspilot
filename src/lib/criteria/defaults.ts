import type { Area, Codes, Criteria, FitRule, Indicator, Level, Tier } from "../types";

export const DEFAULT_RULE: FitRule = { lowMinMajorLow: 2, highMaxMajorLow: 0, highMinMajorHigh: "half" };

type Opt = [id: string, label: string, level: Level, hint?: string];

function ind(id: string, name: string, tier: Tier, description: string, opts: Opt[]): Indicator {
  return {
    id,
    name,
    tier,
    description,
    options: opts.map(([oid, label, level, hint]) => ({ id: oid, label, level, ...(hint ? { hint } : {}) })),
  };
}

function areas(): Area[] {
  return [
    {
      id: "char",
      name: "과제 특성",
      question: "생산성 효과가 클 일인가",
      indicators: [
        ind("devType", "개발 성격", "MAJOR", "신규 구축인지, 기존 시스템을 고치는 일인지", [
          ["new", "신규", "H", "새 시스템·새 모듈을 처음부터 만든다"],
          ["mixed", "혼합", "M", "신규 개발과 기존 코드 수정이 섞여 있다"],
          ["legacy", "레거시", "L", "기존 시스템 개선·유지보수가 중심이다"],
        ]),
        ind("reqType", "대표 요구사항 유형", "MAJOR", "요구사항이 반복되는 패턴인지, 새 설계가 필요한지", [
          ["standard", "표준 패턴", "H", "CRUD·조회·리포트처럼 정형화된 패턴"],
          ["exception", "예외 처리 위주", "M", "기본 패턴에 예외 규칙이 많이 붙는다"],
          ["design", "신규 설계", "L", "선례 없는 구조·알고리즘 설계가 필요하다"],
        ]),
        ind("execType", "수행 유형", "MINOR", "전환·신규 구축인지, 기존 기능 변경인지", [
          ["convert", "전환·신규", "H"],
          ["change", "기능 변경", "M"],
        ]),
        ind("scope", "변경 범위", "MINOR", "변경이 미치는 모듈·시스템의 넓이", [
          ["single", "단일 모듈", "H"],
          ["multiModule", "복수 모듈", "M"],
          ["multiSystem", "복수 시스템", "L"],
        ]),
        ind("risk", "영향도 Risk", "MAJOR", "결함이 생겼을 때 생산·운영에 미치는 영향", [
          ["low", "낮음", "H"],
          ["mid", "보통", "M"],
          ["high", "높음", "L", "FAB 가동·품질 판정 등에 직접 영향"],
        ]),
      ],
    },
    {
      id: "know",
      name: "지식 자산화",
      question: "AI가 참고할 맥락이 있나",
      indicators: [
        ind("rag", "지식 그래프 / RAG", "MINOR", "도메인 지식을 검색 가능한 형태로 구축했는지", [
          ["built", "구축됨", "H"],
          ["partial", "일부", "M"],
          ["none", "없음", "L"],
        ]),
        ind("funcSpec", "기능 정의서", "MAJOR", "당시 확정된 기능 정의서의 최신성·상세도", [
          ["detailed", "최신·상세", "H"],
          ["partial", "부분·구버전", "M"],
          ["none", "없음", "L"],
        ]),
        ind("archDoc", "아키텍처 문서", "MINOR", "시스템 구조·배포 구성 문서", [
          ["current", "최신", "H"],
          ["partial", "부분", "M"],
          ["none", "없음", "L"],
        ]),
        ind("ifSpec", "인터페이스·데이터 명세서", "MINOR", "연계 인터페이스와 데이터 구조 명세", [
          ["current", "최신", "H"],
          ["partial", "부분", "M"],
          ["none", "없음", "L"],
        ]),
        ind("exception", "예외 사례 정리", "MINOR", "운영 중 발생한 예외·장애 사례 기록", [
          ["organized", "정리됨", "H"],
          ["partial", "일부", "M"],
          ["none", "없음", "L"],
        ]),
      ],
    },
    {
      id: "tool",
      name: "AI 도구 활용성",
      question: "Agent가 어디까지 실행하나",
      indicators: [
        ind("netModel", "실행망 모델 연결", "MAJOR", "개발 환경에서 AI 모델을 호출할 수 있는지", [
          ["available", "연결 가능", "H"],
          ["limited", "제한적", "M"],
          ["blocked", "불가", "L"],
        ]),
        ind("readScope", "자산 읽기 범위", "MINOR", "Agent 가 읽을 수 있는 소스·문서의 범위", [
          ["full", "전체 소스·문서", "H"],
          ["partial", "일부", "M"],
          ["none", "불가", "L"],
        ]),
        ind("agentScope", "Agent 수행 범위", "MAJOR", "Agent 가 직접 실행할 수 있는 작업의 범위", [
          ["buildTest", "빌드·테스트 실행까지", "H"],
          ["codeGen", "코드 생성·수정", "M"],
          ["adviceOnly", "조언·검토만", "L"],
        ]),
        ind("telemetry", "텔레메트리 수집", "MINOR", "AI 사용량·토큰을 측정할 수 있는지", [
          ["auto", "자동 수집", "H"],
          ["manual", "수동 기록", "M"],
          ["none", "불가", "L"],
        ]),
      ],
    },
    {
      id: "gov",
      name: "개발 거버넌스",
      question: "결과를 통제·검증할 수 있나",
      indicators: [
        ind("vcs", "버전 관리", "MAJOR", "소스 변경 이력을 추적할 수 있는지", [
          ["git", "Git", "H"],
          ["otherVcs", "기타 VCS", "M"],
          ["none", "없음", "L"],
        ]),
        ind("devRule", "레거시 개발 규칙", "MINOR", "코딩·명명·구조 규칙이 정리돼 있는지", [
          ["documented", "문서화됨", "H"],
          ["implicit", "암묵적", "M"],
          ["none", "없음", "L"],
        ]),
        ind("regression", "회귀시험", "MAJOR", "변경 후 기존 기능을 검증하는 수단", [
          ["automated", "자동화", "H"],
          ["manual", "수동 시나리오", "M"],
          ["none", "없음", "L"],
        ]),
        ind("aiReview", "AI 산출물 검토 체계", "MINOR", "AI 가 만든 산출물을 누가 어떻게 검토하는지", [
          ["defined", "체계 있음", "H"],
          ["individual", "담당자 재량", "M"],
          ["none", "없음", "L"],
        ]),
      ],
    },
  ];
}

export function defaultCriteria(): Criteria {
  return { version: 1, publishedAt: null, publishedBy: null, rule: { ...DEFAULT_RULE }, areas: areas() };
}

export function defaultCodes(): Codes {
  return {
    langs: [
      { code: "JAVA", label: "Java" },
      { code: "CSHARP", label: "C#" },
      { code: "PYTHON", label: "Python" },
      { code: "JS_TS", label: "JavaScript·TypeScript" },
      { code: "C_CPP", label: "C·C++" },
      { code: "PLSQL", label: "PL/SQL" },
      { code: "ETC", label: "기타" },
    ],
    domains: [
      { code: "FAB", label: "제조·FAB" },
      { code: "QUALITY", label: "품질" },
      { code: "EQUIP", label: "설비" },
      { code: "RND", label: "연구개발" },
      { code: "MGMT", label: "경영지원" },
      { code: "INFRA", label: "인프라" },
      { code: "ETC", label: "기타" },
    ],
    sysTypes: [
      { code: "WEB", label: "웹" },
      { code: "BATCH", label: "배치" },
      { code: "EAI", label: "인터페이스·EAI" },
      { code: "DATA", label: "데이터·분석" },
      { code: "EMBEDDED", label: "임베디드·장비" },
      { code: "ETC", label: "기타" },
    ],
    target: { total: 9, byFit: { H: 3, M: 3, L: 3 }, minPerDevType: 1, minLangKinds: 3 },
  };
}
