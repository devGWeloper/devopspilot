import { deriveColumns } from "../fitness";
import type { AgreeCd, Criteria, Level, Project, ProjectStatus, ReplayPhase, ReviewEntry } from "../types";

interface Sample {
  prjNm: string;
  sysNm: string;
  pm: "pm01" | "pm02";
  status: ProjectStatus;
  domainCd: string;
  sysTypeCd: string;
  langCds: string[];
  techStack: string;
  description: string;
  levels: string;
  confirm?: Level;
  totalMm: number;
  phaseMm: [number, number, number, number];
  period: [string, string];
  reviews?: [side: "AX" | "HX", agree: AgreeCd, text: string][];
  statusNote?: string;
}

// levels: 지표 순서대로 18자(H/M/L/-). '-' 는 미응답.
// 순서 = devType reqType execType scope risk | rag funcSpec archDoc ifSpec exception | netModel readScope agentScope telemetry | vcs devRule regression aiReview
const SAMPLES: Sample[] = [
  {
    prjNm: "설비 이력 조회 시스템 고도화",
    sysNm: "EQP-Hist",
    pm: "pm01",
    status: "SELECTED",
    domainCd: "EQUIP",
    sysTypeCd: "WEB",
    langCds: ["JAVA", "JS_TS"],
    techStack: "Spring Boot, React, Oracle",
    description: "설비 가동·정비 이력 조회 화면과 Lot 이동 인터페이스를 신규로 구축한 과제",
    levels: "HHHHH MHHMM HHHM HMHM",
    confirm: "H",
    totalMm: 14,
    phaseMm: [2, 3, 6, 3],
    period: ["2025-03-01", "2025-08-31"],
    reviews: [
      ["AX", "AGREE", "기능 정의서와 회귀시험 자동화가 갖춰져 Replay 기준선 확보가 쉽습니다."],
      ["HX", "AGREE", "설비 담당 부서와 재현 범위 협의 완료."],
    ],
  },
  {
    prjNm: "품질 판정 룰 엔진 개선",
    sysNm: "QMS-Rule",
    pm: "pm01",
    status: "SELECTED",
    domainCd: "QUALITY",
    sysTypeCd: "BATCH",
    langCds: ["JAVA"],
    techStack: "Java 8, Spring Batch, Oracle",
    description: "품질 판정 룰 엔진의 예외 규칙을 정리하고 배치 성능을 개선",
    levels: "MMMMM MHMMH HMMM HMMM",
    confirm: "M",
    totalMm: 9,
    phaseMm: [1, 2, 4, 2],
    period: ["2025-01-06", "2025-04-30"],
    reviews: [["AX", "AGREE", "혼합형 대표 과제로 적합."], ["HX", "HOLD", "운영 영향도 재확인 필요."]],
  },
  {
    prjNm: "레거시 정산 로직 이관",
    sysNm: "FIN-Settle",
    pm: "pm02",
    status: "SELECTED",
    domainCd: "MGMT",
    sysTypeCd: "BATCH",
    langCds: ["PLSQL"],
    techStack: "Oracle PL/SQL, Pro*C",
    description: "20년 된 PL/SQL 정산 로직을 신규 구조로 이관",
    levels: "LLMML LMLML MMML MLMM",
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
    domainCd: "FAB",
    sysTypeCd: "WEB",
    langCds: ["JS_TS"],
    techStack: "React Native, Node.js",
    description: "작업지시 확인·완료 처리를 모바일로 제공",
    levels: "HHHHM MHMHM HHHH HMMM",
    totalMm: 6,
    phaseMm: [1, 1, 3, 1],
    period: ["2025-05-01", "2025-07-31"],
  },
  {
    prjNm: "장비 알람 수집 인터페이스",
    sysNm: "EAI-Alarm",
    pm: "pm02",
    status: "REVIEW",
    domainCd: "EQUIP",
    sysTypeCd: "EAI",
    langCds: ["C_CPP", "JAVA"],
    techStack: "C++, TIBCO, Java",
    description: "장비 알람을 실시간 수집해 MES 로 전달하는 인터페이스",
    levels: "MLMLL MMMHL MLMM HLML",
    totalMm: 8,
    phaseMm: [1, 2, 3, 2],
    period: ["2025-02-03", "2025-05-30"],
    reviews: [["HX", "DISAGREE", "장비 연동 테스트 환경 재현이 어렵습니다."]],
  },
  {
    prjNm: "연구 데이터 분석 포털",
    sysNm: "RND-Portal",
    pm: "pm02",
    status: "SUBMITTED",
    domainCd: "RND",
    sysTypeCd: "DATA",
    langCds: ["PYTHON"],
    techStack: "Python, FastAPI, Vue",
    description: "연구소 실험 데이터 검색·시각화 포털 신규 구축",
    levels: "HMHHH HHMHM HHHH HMHM",
    totalMm: 10,
    phaseMm: [2, 2, 4, 2],
    period: ["2025-04-01", "2025-09-30"],
  },
  {
    prjNm: "출하 검사 리포트 자동화",
    sysNm: "QMS-Report",
    pm: "pm01",
    status: "SUBMITTED",
    domainCd: "QUALITY",
    sysTypeCd: "WEB",
    langCds: ["CSHARP"],
    techStack: ".NET 6, MSSQL",
    description: "출하 검사 결과 리포트를 자동 생성",
    levels: "MHMHM MMMMH MMMH HMHM",
    totalMm: 5,
    phaseMm: [1, 1, 2, 1],
    period: ["2025-06-02", "2025-08-29"],
  },
  {
    prjNm: "인프라 자산 관리 개선",
    sysNm: "ITAM",
    pm: "pm02",
    status: "RESERVE",
    domainCd: "INFRA",
    sysTypeCd: "WEB",
    langCds: ["JAVA"],
    techStack: "Spring MVC, JSP",
    description: "서버·네트워크 자산 관리 화면 기능 변경",
    levels: "LMMHM MMHMM HMMM HMMM",
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
    domainCd: "FAB",
    sysTypeCd: "DATA",
    langCds: ["JS_TS", "PYTHON"],
    techStack: "Next.js, Python",
    description: "Lot 이동 경로와 지연 구간을 시각화",
    levels: "HHHM- -H--- H-H- H-H-",
    totalMm: 7,
    phaseMm: [1, 2, 3, 1],
    period: ["2025-07-01", "2025-10-31"],
  },
  {
    prjNm: "설비 PM 일정 최적화",
    sysNm: "EQP-PM",
    pm: "pm02",
    status: "SUPPLEMENT",
    domainCd: "EQUIP",
    sysTypeCd: "BATCH",
    langCds: ["PYTHON", "PLSQL"],
    techStack: "Python, Oracle",
    description: "예방정비 일정 산출 배치를 최적화",
    levels: "MLMMM LMLMM HMMM HMLM",
    totalMm: 6,
    phaseMm: [1, 2, 2, 1],
    period: ["2024-11-04", "2025-02-28"],
    statusNote: "기능 정의서 보유 범위와 회귀시험 현황을 보완해 주세요.",
  },
  {
    prjNm: "장비 제어 펌웨어 수정",
    sysNm: "EQP-FW",
    pm: "pm02",
    status: "EXCLUDED",
    domainCd: "EQUIP",
    sysTypeCd: "EMBEDDED",
    langCds: ["C_CPP"],
    techStack: "Embedded C",
    description: "장비 제어 펌웨어 예외 처리 수정",
    levels: "LLMLL LLLLM LLLL MLLL",
    confirm: "L",
    totalMm: 5,
    phaseMm: [1, 1, 2, 1],
    period: ["2024-10-01", "2025-01-15"],
    statusNote: "실행망 모델 연결 불가로 Replay 수행이 불가능합니다.",
  },
  {
    prjNm: "인사 평가 시스템 화면 개편",
    sysNm: "HR-Eval",
    pm: "pm01",
    status: "DRAFT",
    domainCd: "MGMT",
    sysTypeCd: "WEB",
    langCds: ["JAVA", "JS_TS"],
    techStack: "Spring Boot, Vue",
    description: "평가 입력 화면 개편",
    levels: "M---- ----- ---- ----",
    totalMm: 3,
    phaseMm: [0.5, 0.5, 1.5, 0.5],
    period: ["2025-08-01", "2025-09-30"],
  },
];

const PM_NM: Record<Sample["pm"], string> = { pm01: "김지훈", pm02: "박서연" };

function answersFor(c: Criteria, levels: string): Record<string, string> {
  const flat = levels.replace(/\s/g, "");
  const inds = c.areas.flatMap((a) => a.indicators);
  const out: Record<string, string> = {};
  inds.forEach((ind, i) => {
    const lv = flat[i];
    if (!lv || lv === "-") return;
    const opt = ind.options.find((o) => o.level === lv) ?? ind.options[ind.options.length - 1];
    out[ind.id] = opt.id;
  });
  return out;
}

export function sampleProjects(c: Criteria, now: string): Project[] {
  return SAMPLES.map((s, idx) => {
    const prjId = `PRJ-${String(idx + 1).padStart(4, "0")}`;
    const phases: ReplayPhase[] = ["ANALYSIS", "DESIGN", "DEV", "TEST"];
    const base: Project["base"] = {
      description: s.description,
      domainCd: s.domainCd,
      sysTypeCd: s.sysTypeCd,
      langCds: s.langCds,
      techStack: s.techStack,
      orgNm: s.pm === "pm01" ? "SK AX 제조DT팀" : "SK AX 경영DT팀",
      baseline: {
        startDate: s.period[0],
        endDate: s.period[1],
        totalMm: s.totalMm,
        phaseMm: { ANALYSIS: s.phaseMm[0], DESIGN: s.phaseMm[1], DEV: s.phaseMm[2], TEST: s.phaseMm[3] },
        screens: s.sysTypeCd === "WEB" ? 12 + idx : null,
        programs: 20 + idx * 3,
        loc: 8000 + idx * 1500,
        replayPhases: phases.slice(1),
      },
    };
    const evalData: Project["eval"] = {
      answers: answersFor(c, s.levels),
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
