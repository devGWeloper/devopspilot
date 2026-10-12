import { deriveColumns } from "../fitness";
import { emptyBase } from "../projects/base";
import type { AgreeCd, Criteria, Level, Project, ProjectBase, ProjectStatus, ReplayPhase, ReviewEntry } from "../types";

interface Sample {
  prjNm: string;
  sysNm: string;
  pm: "pm01" | "pm02";
  status: ProjectStatus;
  base: Partial<Omit<ProjectBase, "baseline">>;
  answers: string;
  confirm?: Level;
  totalMm: number | null;
  phaseMm: [number, number, number, number];
  period: [string, string];
  reviews?: [side: "AX" | "HX", agree: AgreeCd, text: string][];
  statusNote?: string;
}

// answers: ANSWER_ORDER 순서대로 선택지 id, '-' 는 미응답.
const ANSWER_ORDER = ["spec", "context", "pattern", "wbs", "vcs", "tracker", "aiExp", "aiCert"];

const SAMPLES: Sample[] = [
  {
    prjNm: "설비 상태 조회 화면 고도화",
    sysNm: "smartMES",
    pm: "pm01",
    status: "SELECTED",
    base: {
      domainCd: "MES", orgNm: "FAB MOS", sysGradeCd: "L2", sysTypeCd: "WEB_CLOUD", workAreaCd: "IMPROVE", langCds: ["JAVA", "JS_TS"], techStack: "Spring Boot, React, Oracle",
      description: "설비 상태 조회 조건과 화면 항목을 추가한 기능 개선 과제",
      llmTypeCd: "PUBLIC", aiToolCd: "CLAUDE_CODE", aiAccounts: 2, llmModel: "Claude Opus", aiPlanCd: "MAX", tokenCd: "T_1M",
      fitEvaluator: "김개발", pmFit: "H", pmFitReason: "기존 조회 화면 패턴 복제 위주이고 화면 정의서가 있어 효과가 클 것으로 보임",
      staffNms: "김개발, 정수민",
    },
    answers: "clear able repeat yes bitbucket jira daily bootcamp",
    confirm: "H",
    totalMm: 14,
    phaseMm: [2, 3, 6, 3],
    period: ["2025-03-01", "2025-08-31"],
    reviews: [
      ["AX", "AGREE", "화면 정의서와 WBS 실적이 갖춰져 Replay 기준선 확보가 쉽습니다."],
      ["HX", "AGREE", "FAB MOS 와 재현 범위 협의 완료."],
    ],
  },
  {
    prjNm: "품질 판정 룰 엔진 개선",
    sysNm: "QMS-Rule",
    pm: "pm01",
    status: "SELECTED",
    base: {
      domainCd: "MES", orgNm: "품질시스템팀", sysGradeCd: "L1", sysTypeCd: "SERVER", workAreaCd: "IMPROVE", langCds: ["JAVA"], techStack: "Java 8, Spring Batch, Oracle",
      description: "품질 판정 룰 엔진의 예외 규칙을 정리하고 배치 성능을 개선",
      llmTypeCd: "INTERNAL", aiToolCd: "INHOUSE_AGENT", aiAccounts: 2, aiPlanCd: "INHOUSE", tokenCd: "T_10M",
      fitEvaluator: "박개발", pmFit: "M", pmFitReason: "예외 규칙 일부가 문서화되지 않아 맥락 보완이 필요함",
      staffNms: "박개발",
    },
    answers: "partial partial variant yes bitbucket jira trial bootcamp",
    confirm: "M",
    totalMm: 9,
    phaseMm: [1, 2, 4, 2],
    period: ["2025-01-06", "2025-04-30"],
    reviews: [["AX", "AGREE", "중 적합도 대표 과제로 적합."], ["HX", "HOLD", "운영 영향도 확인 필요."]],
  },
  {
    prjNm: "레거시 정산 로직 전환",
    sysNm: "FIN-Settle",
    pm: "pm02",
    status: "SELECTED",
    base: {
      domainCd: "MIS", orgNm: "재무시스템팀", sysGradeCd: "L1", sysTypeCd: "SERVER", workAreaCd: "CONVERT", langCds: ["PLSQL"], techStack: "Oracle PL/SQL, Pro*C",
      description: "20년 된 PL/SQL 정산 로직을 신규 구조로 전환",
      llmTypeCd: "HYBRID", aiToolCd: "CODEX", aiAccounts: 1, aiPlanCd: "TEAM", tokenCd: "T_10M_PLUS",
      fitEvaluator: "최개발", pmFit: "L", pmFitReason: "암묵지 규칙이 많고 연계 구조를 새로 판단해야 해 효과가 작을 것으로 보임",
      staffNms: "최개발, 한지원",
    },
    answers: "partial hard design yes svn redmine trial literacy",
    confirm: "L",
    totalMm: 11,
    phaseMm: [2, 3, 4, 2],
    period: ["2024-09-02", "2025-01-31"],
    reviews: [["AX", "AGREE", "하 적합도 표본으로 선정 — 레거시 한계 측정 목적."]],
  },
  {
    prjNm: "FAB 작업지시 모바일 화면",
    sysNm: "MES-Mobile",
    pm: "pm01",
    status: "REVIEW",
    base: {
      domainCd: "MES", orgNm: "FAB MOS", sysGradeCd: "L2", sysTypeCd: "MOBILE", workAreaCd: "NEW", langCds: ["JS_TS"], techStack: "React Native, Node.js",
      description: "작업지시 확인·완료 처리를 모바일로 제공",
      llmTypeCd: "PUBLIC", aiToolCd: "CURSOR", aiAccounts: 2, aiPlanCd: "PRO", tokenCd: "T_1M",
      fitEvaluator: "이개발", pmFit: "H", pmFitReason: "신규 화면이라 패턴 변형이지만 명세가 명확해 효과가 클 것으로 판단",
      staffNms: "이개발, 정수민",
    },
    answers: "clear able variant yes gitlab jira daily master",
    totalMm: 6,
    phaseMm: [1, 1, 3, 1],
    period: ["2025-05-01", "2025-07-31"],
  },
  {
    prjNm: "설비 이벤트 수신 로직 변경",
    sysNm: "EAI-Alarm",
    pm: "pm02",
    status: "REVIEW",
    base: {
      domainCd: "MES", orgNm: "P&S", sysGradeCd: "L0", sysTypeCd: "EQUIP", workAreaCd: "IMPROVE", langCds: ["C_CPP", "JAVA"], techStack: "C++, TIBCO, Java",
      description: "설비 알람 이벤트를 수신해 MES 로 전달하는 로직 변경",
      llmTypeCd: "INTERNAL", aiToolCd: "INHOUSE_AGENT", aiAccounts: 2, aiPlanCd: "INHOUSE", tokenCd: "T_10M",
      fitEvaluator: "박개발", pmFit: "L", pmFitReason: "설비·MES 다중 연계와 암묵지 규칙이 많아 코드 분석 부담이 큼",
      staffNms: "박개발, 최개발",
    },
    answers: "partial hard design no svn doc trial none",
    totalMm: null,
    phaseMm: [1, 2, 3, 2],
    period: ["2025-02-03", "2025-05-30"],
    reviews: [["HX", "DISAGREE", "장비 연동 테스트 환경 재현이 어렵습니다."]],
  },
  {
    prjNm: "연구 데이터 분석 포털",
    sysNm: "RND-Portal",
    pm: "pm02",
    status: "SUBMITTED",
    base: {
      domainCd: "MIS", orgNm: "연구정보팀", sysGradeCd: "L3", sysTypeCd: "WEB_ONPREM", workAreaCd: "NEW", langCds: ["PYTHON"], techStack: "Python, FastAPI, Vue",
      description: "연구소 실험 데이터 검색·시각화 포털 신규 구축",
      llmTypeCd: "PUBLIC", aiToolCd: "CLAUDE_CODE", aiAccounts: 3, aiPlanCd: "MAX", tokenCd: "T_10M",
      fitEvaluator: "한개발", pmFit: "H", pmFitReason: "조회·시각화 화면 반복이 많고 명세가 명확함",
      staffNms: "한개발, 오민지, 윤태호",
    },
    answers: "clear able repeat yes github jira daily bootcamp",
    totalMm: 10,
    phaseMm: [2, 2, 4, 2],
    period: ["2025-04-01", "2025-09-30"],
  },
  {
    prjNm: "출하 검사 리포트 자동화",
    sysNm: "QMS-Report",
    pm: "pm01",
    status: "SUBMITTED",
    base: {
      domainCd: "MES", orgNm: "품질시스템팀", sysGradeCd: "L2", sysTypeCd: "CS", workAreaCd: "IMPROVE", langCds: ["CSHARP"], techStack: ".NET 6, MSSQL",
      description: "출하 검사 결과 리포트를 자동 생성",
      llmTypeCd: "PUBLIC", aiToolCd: "COPILOT", aiAccounts: 1, aiPlanCd: "TEAM", tokenCd: "T_1M",
      fitEvaluator: "윤개발", pmFit: "M", pmFitReason: "리포트 양식은 반복이지만 검사 기준 연계는 사람이 보완해야 함",
      staffNms: "윤개발",
    },
    answers: "clear partial repeat yes azure azure trial literacy",
    totalMm: 5,
    phaseMm: [1, 1, 2, 1],
    period: ["2025-06-02", "2025-08-29"],
  },
  {
    prjNm: "인프라 자산 관리 개선",
    sysNm: "ITAM",
    pm: "pm02",
    status: "RESERVE",
    base: {
      domainCd: "MIS", orgNm: "IT인프라팀", sysGradeCd: "L3", sysTypeCd: "WEB_ONPREM", workAreaCd: "IMPROVE", langCds: ["JAVA"], techStack: "Spring MVC, JSP",
      description: "서버·네트워크 자산 관리 화면 기능 변경",
      llmTypeCd: "HYBRID", aiToolCd: "CLAUDE_CODE", aiAccounts: 1, aiPlanCd: "PRO", tokenCd: "T_1M",
      fitEvaluator: "오개발", pmFit: "M", pmFitReason: "화면 패턴은 있으나 일부 신규 집계 로직이 필요",
      staffNms: "오개발",
    },
    answers: "partial able variant yes bitbucket redmine trial bootcamp",
    confirm: "M",
    totalMm: 4,
    phaseMm: [1, 1, 1, 1],
    period: ["2025-03-03", "2025-05-30"],
  },
  {
    prjNm: "Lot 추적 대시보드",
    sysNm: "MES-Trace",
    pm: "pm01",
    status: "DRAFT",
    base: {
      domainCd: "MES", orgNm: "FAB MOS", sysTypeCd: "WEB_CLOUD", workAreaCd: "NEW", langCds: ["JS_TS", "PYTHON"], techStack: "Next.js, Python",
      description: "Lot 이동 경로와 지연 구간을 시각화",
      llmTypeCd: "PUBLIC",
    },
    answers: "clear able - yes - - - -",
    totalMm: 7,
    phaseMm: [1, 2, 3, 1],
    period: ["2025-07-01", "2025-10-31"],
  },
  {
    prjNm: "설비 PM 일정 최적화",
    sysNm: "EQP-PM",
    pm: "pm02",
    status: "SUPPLEMENT",
    base: {
      domainCd: "MES", orgNm: "설비기술팀", sysGradeCd: "L1", sysTypeCd: "SERVER", workAreaCd: "REBUILD", langCds: ["PYTHON", "PLSQL"], techStack: "Python, Oracle",
      description: "예방정비 일정 산출 배치를 새 구조로 재구축",
      llmTypeCd: "INTERNAL", aiToolCd: "INHOUSE_OSS", aiAccounts: 1, tokenCd: "UNKNOWN",
      fitEvaluator: "정개발", pmFit: "M", pmFitReason: "산출 규칙 일부만 문서화돼 있음",
      staffNms: "정개발",
    },
    answers: "partial partial variant no gitlab doc trial none",
    totalMm: null,
    phaseMm: [1, 2, 2, 1],
    period: ["2024-11-04", "2025-02-28"],
    statusNote: "WBS 실적이 없어 기준 공수 근거(공수 산정서 등)를 보완해 주세요.",
  },
  {
    prjNm: "장비 제어 펌웨어 수정",
    sysNm: "EQP-FW",
    pm: "pm02",
    status: "EXCLUDED",
    base: {
      domainCd: "MES", orgNm: "P&S", sysGradeCd: "L0", sysTypeCd: "EQUIP", workAreaCd: "IMPROVE", langCds: ["C_CPP"], techStack: "Embedded C",
      description: "장비 제어 펌웨어 예외 처리 수정",
      llmTypeCd: "TBD", aiToolCd: "TBD", aiAccounts: 1,
      fitEvaluator: "최개발", pmFit: "L", pmFitReason: "명세가 모호하고 설비 연계 맥락을 넣기 어려움",
      staffNms: "최개발",
    },
    answers: "vague hard design no none none none none",
    confirm: "L",
    totalMm: null,
    phaseMm: [1, 1, 2, 1],
    period: ["2024-10-01", "2025-01-15"],
    statusNote: "버전관리 이력이 없고 장비 맥락 주입이 어려워 Replay 비교가 불가능합니다.",
  },
  {
    prjNm: "인사 평가 시스템 화면 개편",
    sysNm: "HR-Eval",
    pm: "pm01",
    status: "DRAFT",
    base: {
      domainCd: "MIS", orgNm: "경영지원시스템팀", sysTypeCd: "WEB_ONPREM", workAreaCd: "MIXED", langCds: ["JAVA", "JS_TS"], techStack: "Spring Boot, Vue",
      description: "평가 입력 화면 개편",
      remark: "화면 개편(기능 개선) + 평가 집계 배치 전환",
    },
    answers: "clear - - - - - - -",
    totalMm: 3,
    phaseMm: [0.5, 0.5, 1.5, 0.5],
    period: ["2025-08-01", "2025-09-30"],
  },
];

const PM_NM: Record<Sample["pm"], string> = { pm01: "김지훈", pm02: "박서연" };

function answersFor(c: Criteria, compact: string): Record<string, string> {
  const ids = compact.split(/\s+/);
  const out: Record<string, string> = {};
  ANSWER_ORDER.forEach((indId, i) => {
    const oid = ids[i];
    const ind = c.areas.flatMap((a) => a.indicators).find((x) => x.id === indId);
    if (oid && oid !== "-" && ind?.options.some((o) => o.id === oid)) out[indId] = oid;
  });
  return out;
}

export function sampleProjects(c: Criteria, now: string): Project[] {
  return SAMPLES.map((s, idx) => {
    const prjId = `PRJ-${String(idx + 1).padStart(4, "0")}`;
    const phases: ReplayPhase[] = ["ANALYSIS", "DESIGN", "DEV", "TEST"];
    const base: ProjectBase = {
      ...emptyBase(),
      ...s.base,
      baseline: {
        startDate: s.period[0],
        endDate: s.period[1],
        totalMm: s.totalMm,
        phaseMm: { ANALYSIS: s.phaseMm[0], DESIGN: s.phaseMm[1], DEV: s.phaseMm[2], TEST: s.phaseMm[3] },
        screens: s.base.sysTypeCd?.startsWith("WEB") ? 12 + idx : null,
        programs: 20 + idx * 3,
        loc: 8000 + idx * 1500,
        replayPhases: phases.slice(1),
      },
    };
    const evalData: Project["eval"] = {
      answers: answersFor(c, s.answers),
      notes: {},
      confirm: s.confirm
        ? { fit: s.confirm, reason: "선정 회의(10/02) 합의", by: "admin", byNm: "AX 관리자", at: now }
        : null,
    };
    const reviews: ReviewEntry[] = (s.reviews ?? []).map(([side, agree, text], i) => ({
      id: `${prjId}-r${i + 1}`,
      side,
      userId: side === "AX" ? "admin" : "hx01",
      userNm: side === "AX" ? "AX 관리자" : "이현우",
      agree,
      text,
      at: now,
      context: "SELECTION",
    }));
    const last = (side: "AX" | "HX"): AgreeCd => [...reviews].reverse().find((r) => r.side === side)?.agree ?? "NONE";
    return {
      prjId,
      prjNm: s.prjNm,
      sysNm: s.sysNm,
      pmUserId: s.pm,
      pmUserNm: PM_NM[s.pm],
      status: s.status,
      statusNote: s.statusNote ?? null,
      aiFit: null,
      axAgree: last("AX"),
      hxAgree: last("HX"),
      base,
      eval: evalData,
      reviews,
      ai: null,
      regUserId: s.pm,
      regAt: now,
      updUserId: s.pm,
      updAt: now,
      ...deriveColumns(c, { base, eval: evalData }),
    };
  });
}
