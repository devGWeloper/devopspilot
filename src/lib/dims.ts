// 과제 선정 분포와 측정 결과 교차 분석이 같은 분류 축을 쓰도록 한곳에 둔다. 선택값은 기준정보 엑셀 '02. 요구사항-SDLC'·'01. 과제'.
import { STAGE_LABEL, STAGES, type Project, type Stage } from "./types";

export type DimKey = "fit" | "difficulty" | "grade" | "spec" | "ctx" | "gen" | "stage" | "baseSrc" | "area" | "deployType" | "dept" | "sysGrade";

export interface Dim {
  key: DimKey;
  title: string;
  /** 과제 속성이면 과제 단위로 센다, 아니면 공수 태그 단위 */
  level: "tag" | "prj";
  cats: string[];
}

const LV = ["상", "중", "하"];

export const DIMS: Dim[] = [
  { key: "fit", title: "예상 기대효과", level: "tag", cats: LV },
  { key: "difficulty", title: "구현 난이도", level: "tag", cats: LV },
  { key: "grade", title: "필요 개발자 등급", level: "tag", cats: ["특급", "고급", "중급", "초급"] },
  { key: "spec", title: "명세 명확성", level: "tag", cats: LV },
  { key: "ctx", title: "맥락 주입 가능성", level: "tag", cats: LV },
  { key: "gen", title: "생성 패턴", level: "tag", cats: LV },
  { key: "stage", title: "SDLC 단계", level: "tag", cats: STAGES.map((s) => STAGE_LABEL[s]) },
  { key: "baseSrc", title: "공수 출처", level: "tag", cats: ["WBS 실적", "공수 산정서", "과거 실적", "담당자 추정"] },
  { key: "area", title: "과제 영역", level: "prj", cats: ["신규 구축", "기능 개선", "전환", "재구축 (차세대)", "혼합"] },
  { key: "deployType", title: "배포 형식", level: "prj", cats: ["Web — On-Premise", "Web — Cloud", "C/S — 설치형", "Mobile", "서버 전용 (UI 없음)", "설비·Embedded", "복합"] },
  { key: "dept", title: "하이닉스 담당", level: "prj", cats: ["MES", "MIS"] },
  { key: "sysGrade", title: "시스템 등급", level: "prj", cats: ["L0", "L1", "L2", "L3", "L4"] },
];

/** 공수 태그의 분류 축 값. 비어 있으면 "" (미입력) */
export function dimValues(p: Project, s: Stage): Record<DimKey, string> {
  return {
    fit: s.fit,
    difficulty: s.difficulty,
    grade: s.grade,
    spec: s.spec,
    ctx: s.ctx,
    gen: s.gen,
    stage: STAGE_LABEL[s.cd],
    baseSrc: s.baseSrc,
    area: p.area,
    deployType: p.deployType,
    dept: p.deptCd,
    sysGrade: p.sysGrade,
  };
}

/** 정해진 선택값 순서 + 정해진 값 밖(기타 입력) 뒤에 */
export function catsOf(d: Dim, seen: string[]): string[] {
  const extra = Array.from(new Set(seen.filter((v) => v && !d.cats.includes(v)))).sort();
  return [...d.cats, ...extra];
}
