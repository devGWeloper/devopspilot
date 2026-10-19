// 과제 선정 분포와 측정 결과 교차 분석이 같은 분류 축을 쓰도록 한곳에 둔다. 선택값 순서는 선정 양식 '코드값' 시트.
import { STAGE_LABEL, STAGES, type Project, type Requirement } from "./types";

export type DimKey = "fit" | "difficulty" | "grade" | "stage" | "kind" | "area" | "deployType" | "dept" | "sysGrade" | "tool" | "llm" | "spec" | "ctx" | "gen";

export interface Dim {
  key: DimKey;
  title: string;
  /** 과제 속성이면 과제 단위로 센다 */
  level: "req" | "prj";
  cats: string[];
}

export const DIMS: Dim[] = [
  { key: "fit", title: "예상 기대효과", level: "req", cats: ["상", "중", "하"] },
  { key: "difficulty", title: "구현 난이도", level: "req", cats: ["상", "중", "하"] },
  { key: "grade", title: "필요 개발자 등급", level: "req", cats: ["특급", "고급", "중급", "초급"] },
  { key: "spec", title: "명세 명확성", level: "req", cats: ["명확", "일부 명확", "모호"] },
  { key: "ctx", title: "맥락 주입 가능성", level: "req", cats: ["가능", "일부 가능", "어려움"] },
  { key: "gen", title: "생성 패턴", level: "req", cats: ["패턴 반복", "패턴 변형", "신규 설계 판단"] },
  { key: "stage", title: "대표 SDLC 단계", level: "req", cats: STAGES.map((s) => STAGE_LABEL[s]) },
  { key: "tool", title: "AI 도구", level: "req", cats: ["Claude Code", "Codex", "Cursor", "GitHub Copilot", "Gemini CLI", "사내 소스코딩 에이전트", "사내 오픈소스 도구"] },
  { key: "llm", title: "LLM 구분", level: "req", cats: ["Public LLM (외부)", "사내 LLM", "Hybrid"] },
  { key: "kind", title: "과제 구분", level: "prj", cats: ["개발", "운영"] },
  { key: "area", title: "과제 영역", level: "prj", cats: ["신규 구축", "기능 개선", "전환", "재구축 (차세대)", "혼합"] },
  { key: "deployType", title: "배포 형식", level: "prj", cats: ["Web — On-Premise", "Web — Cloud", "C/S — 설치형", "Mobile", "서버 전용 (UI 없음)", "설비·Embedded", "복합"] },
  { key: "dept", title: "담당", level: "prj", cats: ["MES", "MIS", "기타"] },
  { key: "sysGrade", title: "시스템 등급", level: "prj", cats: ["L0", "L1", "L2", "L3", "L4"] },
];

export const DIM_BY_KEY = Object.fromEntries(DIMS.map((d) => [d.key, d])) as Record<DimKey, Dim>;

const lv = (v: string | undefined) => {
  const c = (v ?? "").trim().charAt(0);
  return c === "상" || c === "중" || c === "하" ? c : "";
};

/** 요구사항의 분류 축 값. 비어 있으면 "" (미입력) */
export function dimValues(p: Project, r: Requirement): Record<DimKey, string> {
  // 기준 공수가 가장 큰 단계를 대표 단계로 본다 — 요구사항 하나가 여러 단계에 걸치므로.
  const main = [...r.stages].sort((a, b) => b.baseMd - a.baseMd)[0];
  return {
    fit: lv(r.extra["FIT-06"]) || lv(r.extra["FIT-05"]),
    difficulty: r.difficulty,
    grade: r.grade,
    spec: r.extra["FIT-01"] ?? "",
    ctx: r.extra["FIT-02"] ?? "",
    gen: r.extra["FIT-03"] ?? "",
    stage: main ? STAGE_LABEL[main.cd] : "",
    tool: r.extra["AIS-02"] ?? "",
    llm: r.extra["AIS-01"] ?? "",
    kind: p.kind,
    area: p.area,
    deployType: p.deployType,
    dept: p.deptCd,
    sysGrade: p.sysGrade,
  };
}

/** 정해진 선택값 순서 + 양식 밖 값(기타 입력) 뒤에 */
export function catsOf(d: Dim, seen: string[]): string[] {
  const extra = Array.from(new Set(seen.filter((v) => v && !d.cats.includes(v)))).sort();
  return [...d.cats, ...extra];
}
