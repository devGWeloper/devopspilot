import type { Area, CodeItem, Codes, Criteria, FitRule, Indicator, Level, Tier } from "../types";

// 과제 선정 양식 FIT-05: 명세·맥락·생성 중 가장 낮은 항목이 등급을 정한다 (셋 다 유리 = 상, 하나라도 불리 = 하).
export const DEFAULT_RULE: FitRule = { lowMinMajorLow: 1, highMaxMajorLow: 0, highMinMajorHigh: "all" };

type Opt = [id: string, label: string, level: Level, hint?: string];

function ind(id: string, ref: string, name: string, tier: Tier, description: string, opts: Opt[]): Indicator {
  return {
    id,
    ref,
    name,
    tier,
    description,
    options: opts.map(([oid, label, level, hint]) => ({ id: oid, label, level, ...(hint ? { hint } : {}) })),
  };
}

// 양식에는 Major/Minor 구분이 없다. 등급을 정하는 개발자 평가 3항목만 Major 로 두고,
// 값에 좋고 나쁨이 있는 도구·인력 항목은 Minor(보완 신호)로, 나머지 분류 항목은 코드로 둔다.
function areas(): Area[] {
  return [
    {
      id: "fit",
      name: "AI 적합도 — 개발자 평가",
      question: "AI 가 대부분을 만들 수 있는 일인가",
      indicators: [
        ind("spec", "FIT-01", "명세 명확성", "MAJOR", "무엇을 만들지 AI 에 명확히 줄 수 있는가", [
          ["clear", "명확", "H", "입출력·화면·업무 규칙이 문서로 정의돼 그대로 AI 에 줄 수 있음 (예: 화면 정의서·기능 명세 있음)"],
          ["partial", "일부 명확", "M", "핵심은 정의됐으나 예외·세부 규칙은 설명이 필요 (예: 예외 처리 규칙 미정리)"],
          ["vague", "모호", "L", "고객 협의하며 정해지거나 비즈니스 설명이 많이 필요 (예: 요건 협의 진행 중)"],
        ]),
        ind("context", "FIT-02", "맥락 주입 가능성", "MAJOR", "알아야 할 시스템 맥락과 개발 규칙을 AI 에 넣을 수 있는가", [
          ["able", "가능", "H", "맥락이 해당 모듈에 닫혀 있거나, 필요한 규칙·연계 정보를 문서·지침 파일로 줄 수 있음"],
          ["partial", "일부 가능", "M", "일부는 주입 가능하나 연계·예외는 사람이 보완해야 함"],
          ["hard", "어려움", "L", "다중 시스템 연계·암묵지·대용량 코드라 정리해 넣기 어려움 (예: 설비·MES 다중 연계)"],
        ]),
        ind("pattern", "FIT-03", "생성 패턴", "MAJOR", "해법이 기존 패턴의 반복인가, 새로 설계해야 하는가", [
          ["repeat", "패턴 반복", "H", "기존 화면·코드를 복제해 바꾸면 됨 — AI 가 대부분 작성"],
          ["variant", "패턴 변형", "M", "기존 패턴을 바탕으로 일부 새 로직이 필요"],
          ["design", "신규 설계 판단", "L", "구조·로직을 사람이 새로 판단해야 함 (예: 연계 구조 재설계)"],
        ]),
      ],
    },
    {
      id: "tools",
      name: "과제 관리 도구",
      question: "측정 근거를 모을 수 있나",
      indicators: [
        ind("wbs", "PRJ-09", "기존 WBS 실적", "MINOR", "AI 미적용 기준 공수로 쓸 WBS 실적이 있는지", [
          ["yes", "있음", "H", "요구사항·작업 또는 단계별 실제 투입 공수가 WBS 에 기록됨"],
          ["no", "없음", "L", "계획만 있거나 실적 기록이 없음 (예: 공수 산정서만 있음)"],
        ]),
        ind("vcs", "PRJ-10", "버전관리 도구", "MINOR", "소스 버전관리 도구 (커밋·PR 이력 수집용)", [
          ["bitbucket", "Bitbucket", "H"],
          ["github", "GitHub", "H"],
          ["gitlab", "GitLab", "H"],
          ["azure", "Azure Repos", "H"],
          ["svn", "SVN", "M"],
          ["etc", "기타", "M", "비고에 도구명 기재"],
          ["none", "없음", "L"],
        ]),
        ind("tracker", "PRJ-11", "작업관리 도구", "MINOR", "요구사항·이슈 관리 도구 (요구사항 ID 추적용)", [
          ["jira", "Jira", "H"],
          ["redmine", "Redmine", "H"],
          ["azure", "Azure Boards", "H"],
          ["inhouse", "사내 작업관리 시스템", "H"],
          ["doc", "엑셀·문서", "M"],
          ["etc", "기타", "M", "비고에 도구명 기재"],
          ["none", "없음", "L"],
        ]),
      ],
    },
    {
      id: "staff",
      name: "AI 활용 역량",
      question: "수행자가 AI 도구를 다룰 수 있나",
      indicators: [
        ind("aiExp", "REF-02", "AI 활용 개발 경험", "MINOR", "주 수행 개발자의 AI 코딩 도구 사용 수준", [
          ["daily", "실무 상시 사용", "H", "업무에서 AI 코딩 도구를 상시 사용"],
          ["trial", "시범·개인 사용", "M", "시범 적용이나 개인적으로만 사용"],
          ["none", "경험 없음", "L"],
        ]),
        ind("aiCert", "REF-03", "AI 인증 등급", "MINOR", "주 수행 개발자가 수료한 자사 AI 인증 중 가장 높은 과정", [
          ["master", "AI 마스터", "H", "자사 AI 인증 3단계 (최고 과정) 수료"],
          ["bootcamp", "AI 부트캠프", "M", "자사 AI 인증 2단계 수료"],
          ["literacy", "AI 리터러시", "L", "자사 AI 인증 1단계 수료"],
          ["none", "미수료", "L", "수료한 인증 과정 없음"],
        ]),
      ],
    },
  ];
}

export function defaultCriteria(): Criteria {
  return { version: 1, publishedAt: null, publishedBy: null, rule: { ...DEFAULT_RULE }, areas: areas() };
}

type C = [code: string, label: string, desc?: string, example?: string];
const list = (xs: C[]): CodeItem[] =>
  xs.map(([code, label, desc, example]) => ({ code, label, ...(desc ? { desc } : {}), ...(example ? { example } : {}) }));

export function defaultCodes(): Codes {
  return {
    domains: list([["MES", "MES"], ["MIS", "MIS"], ["ETC", "기타"]]),
    sysGrades: list([["L0", "L0", "최상위 등급"], ["L1", "L1"], ["L2", "L2"], ["L3", "L3"], ["L4", "L4"], ["UNKNOWN", "미확인", "등급 확인 전"]]),
    sysTypes: list([
      ["WEB_ONPREM", "Web — On-Premise", "브라우저 기반, 사내 서버에 배포", "사내 포털, 조회·관리 화면"],
      ["WEB_CLOUD", "Web — Cloud", "브라우저 기반, 클라우드(Public·Private)에 배포", "클라우드 기반 대시보드"],
      ["CS", "C/S — 설치형", "PC 에 설치하는 클라이언트 프로그램", "Windows 앱 (C#·WinForm 등)"],
      ["MOBILE", "Mobile", "모바일 앱", "현장용 모바일 앱"],
      ["SERVER", "서버 전용 (UI 없음)", "화면 없이 서버에서 동작하는 프로그램", "Batch, Interface, API"],
      ["EQUIP", "설비·Embedded", "설비 PC·장비 제어와 연동되는 프로그램", "설비 연계 에이전트"],
      ["MIXED", "복합", "2개 이상 섞임 — 비고에 구성 기재", "Web 화면 + 배치"],
    ]),
    workAreas: list([
      ["NEW", "신규 구축", "기존 시스템 없이 새로 개발", "신규 분석 화면 구축"],
      ["IMPROVE", "기능 개선", "기존 시스템에 기능 추가·변경", "조회 조건 추가, 화면 항목 변경"],
      ["CONVERT", "전환", "기능은 유지하고 언어·프레임워크·플랫폼을 변경", "Java 버전업, 프레임워크 전환"],
      ["REBUILD", "재구축 (차세대)", "기존 기능을 새 구조로 다시 구현", "차세대 시스템 구축"],
      ["MIXED", "혼합", "2개 이상 섞임 — 비고에 기재"],
    ]),
    langs: list([
      ["JAVA", "Java"],
      ["CSHARP", "C#"],
      ["PYTHON", "Python"],
      ["JS_TS", "JavaScript·TypeScript"],
      ["C_CPP", "C·C++"],
      ["PLSQL", "PL/SQL"],
      ["ETC", "기타"],
    ]),
    llmTypes: list([
      ["PUBLIC", "Public LLM (외부)", "외부 상용 모델 사용", "인터넷 VDI 환경"],
      ["INTERNAL", "사내 LLM", "사내 구축 모델 사용"],
      ["HYBRID", "Hybrid", "작업에 따라 외부·사내 혼용", "복잡한 작업은 외부, 단순 작업은 사내"],
      ["TBD", "미정", "선정 전"],
    ]),
    aiTools: list([
      ["CLAUDE_CODE", "Claude Code"],
      ["CODEX", "Codex", "CLI·IDE 포함"],
      ["CURSOR", "Cursor"],
      ["COPILOT", "GitHub Copilot"],
      ["GEMINI_CLI", "Gemini CLI"],
      ["INHOUSE_AGENT", "사내 소스코딩 에이전트", "조직에서 자체 구축한 코딩 에이전트", "다비스 기반 에이전트"],
      ["INHOUSE_OSS", "사내 오픈소스 도구", "사내 배포 오픈소스 기반 도구"],
      ["ETC", "기타", "비고에 도구명 기재"],
      ["TBD", "미정", "선정 전"],
    ]),
    aiPlans: list([
      ["PRO", "개인 표준 (Pro급)", "개인 구독 기본 등급"],
      ["MAX", "개인 고사용량 (Max급)", "사용 한도가 큰 개인 구독", "대규모 코드 분석·에이전트 작업"],
      ["TEAM", "Team·Enterprise", "조직 단위 구독"],
      ["API", "API 종량제", "토큰 사용량만큼 과금"],
      ["INHOUSE", "사내 (과금 없음)", "사내 LLM 사용"],
      ["TBD", "미정"],
    ]),
    tokenRanges: list([
      ["T_100K", "10만 미만", "단순 수정 1~2건 수준"],
      ["T_1M", "10만~100만", "기능 1개 개발 수준"],
      ["T_10M", "100만~1,000만", "여러 모듈 분석·개발 수준"],
      ["T_10M_PLUS", "1,000만 이상", "대규모 분석·전환 수준"],
      ["UNKNOWN", "모름"],
    ]),
    target: { total: 9, byFit: { H: 3, M: 3, L: 3 }, minPerDevType: 1, minLangKinds: 3 },
  };
}
