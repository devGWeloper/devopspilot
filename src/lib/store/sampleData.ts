// 데모 데이터 — 목업 v17 의 과제·요구사항을 옮기고, 일자는 실행 시점 기준 최근 평일로 맞춘다(언제 띄워도 '진행 중'으로 보이게).
import { kstDate } from "../measure/ingest";
import { spanMin, type EffortSpan } from "../measure/spans";
import type { ActType, AiSession, DayConf, EffortEntry } from "../measure/types";
import { reqKey, unitCode } from "../measure/units";
import type { Project, StageCd } from "../types";

/** 데모 개발자는 퇴근 무렵(18:30 KST) 그날 세션 파일을 올린 것으로 둔다 */
const upAtOf = (date: string) => `${date}T09:30:00.000Z`;

const LV = ["상", "중", "하"];

const lv = (i: number) => LV[Math.min(2, Math.max(0, i))];

/**
 * 과제마다 AI 에 맞는 정도(0 상 · 1 중 · 2 하)를 두고 단계마다 조금씩 흔든다 — 과제끼리 분포가 갈리게.
 * 선정 양식대로 명세·맥락·생성 패턴은 개발자 평가, 예상 기대효과는 그중 가장 낮은 값(참고 등급)을 보고 PM 이 정한다(가끔 한 단계 올려 잡음).
 */
function demoFit(code: string, bias: number): { fit: string; spec: string; ctx: string; gen: string } {
  const n = Array.from(code).reduce((a, c) => a + c.charCodeAt(0), 0);
  const pick = (k: number) => lv(bias + ((n + k) % 3 === 0 ? 1 : (n + k) % 5 === 0 ? -1 : 0));
  const spec = pick(0);
  const ctx = pick(1);
  const gen = pick(2);
  const worst = Math.max(LV.indexOf(spec), LV.indexOf(ctx), LV.indexOf(gen));
  return { spec, ctx, gen, fit: lv(worst - (n % 2 === 0 ? 1 : 0)) };
}

/** [사번, 성명, SK AX 팀, SK AX 본부] — AI 도구 계정은 사번@skax.demo */
export const DEMO_DEVS: [string, string, string, string][] = [
  ["dev01", "김개발", "MES개발1팀", "제조DX본부"],
  ["dev02", "박개발", "MES개발1팀", "제조DX본부"],
  ["dev03", "최개발", "MES개발2팀", "제조DX본부"],
  ["dev04", "이개발", "물류DX팀", "제조DX본부"],
  ["dev05", "정개발", "물류DX팀", "제조DX본부"],
  ["dev06", "한개발", "경영DX팀", "경영DX본부"],
];
const ID_BY_NM = Object.fromEntries(DEMO_DEVS.map(([id, nm]) => [nm, id]));

type P = [id: string, prjNm: string, sysNm: string, deptCd: string, teamNm: string, pmNm: string, sysGrade: string, deployType: string, area: string, vcs: string, pms: string, axTeam: string, axHq: string];
const PRJ: P[] = [
  ["DAE01", "설비 이벤트 수신 통합", "FAB MOS", "MES", "FAB MOS팀", "이영희", "L1", "서버 전용 (UI 없음)", "기능 개선", "Bitbucket", "Jira", "MES개발1팀", "제조DX본부"],
  ["QAL02", "품질 알람 고도화", "smartMES", "MES", "품질시스템팀", "홍길동", "L2", "Web — On-Premise", "기능 개선", "Bitbucket", "Jira", "MES개발2팀", "제조DX본부"],
  ["LMS03", "물류 조회 화면 개선", "LMS", "MES", "물류시스템팀", "박민수", "L3", "Web — On-Premise", "기능 개선", "GitLab", "Redmine", "물류DX팀", "제조DX본부"],
  ["MIS05", "경영 리포트 전환", "MIS Portal", "MIS", "경영정보팀", "최현우", "L3", "Web — Cloud", "전환", "GitHub", "Jira", "경영DX팀", "경영DX본부"],
  ["EQP04", "설비 PM 일정 자동화", "EQP Portal", "MES", "설비기술팀", "정수진", "L2", "Web — On-Premise", "신규 구축", "GitHub", "Jira", "MES개발2팀", "제조DX본부"],
  ["YLD06", "수율 집계 배치 재구축", "YMS", "MES", "수율분석팀", "강민호", "L1", "서버 전용 (UI 없음)", "재구축 (차세대)", "Bitbucket", "Jira", "MES개발1팀", "제조DX본부"],
  ["RCP07", "레시피 변경 이력 관리", "RMS", "MES", "공정기술팀", "윤서연", "L0", "C/S — 설치형", "기능 개선", "SVN", "Redmine", "MES개발2팀", "제조DX본부"],
  ["HRM08", "인사 평가 화면 신규", "HR Portal", "MIS", "인사시스템팀", "임지훈", "L4", "Web — Cloud", "신규 구축", "GitHub", "Azure Boards", "경영DX팀", "경영DX본부"],
  ["PUR09", "구매 승인 흐름 개선", "SRM", "MIS", "구매시스템팀", "오세훈", "L3", "Web — On-Premise", "기능 개선", "GitLab", "Jira", "경영DX팀", "경영DX본부"],
  ["MOB10", "현장 점검 모바일 앱", "Field App", "MES", "설비보전팀", "서지민", "L2", "Mobile", "신규 구축", "GitHub", "Jira", "물류DX팀", "제조DX본부"],
];
// 과제별 AI 에 맞는 정도(0 상 · 1 중 · 2 하) — 화면 패턴 반복·신규 웹은 높게, 레거시 C/S·암묵지 많은 재구축은 낮게.
const AI_BIAS: Record<string, number> = { DAE01: 1, QAL02: 0, LMS03: 0, MIS05: 1, EQP04: 1, YLD06: 2, RCP07: 2, HRM08: 0, PUR09: 1, MOB10: 1 };

type S = [StageCd, string, string, number];
type R = [prj: number, reqId: string, name: string, difficulty: string, grade: string, baseSrc: string, stages: S[], done: boolean];
const REQS: R[] = [
  [0, "REQ0047", "설비 이벤트 수신 로직 변경", "상", "고급", "WBS 실적", [["AN", "요구사항 분석·정의", "박개발", 1], ["DV", "인터페이스·연계", "김개발", 5.5], ["TS", "통합·회귀 테스트", "김개발", 1.5]], false],
  [0, "REQ0033", "중복 이벤트 처리", "중", "중급", "WBS 실적", [["DV", "백엔드 로직 수정", "박개발", 3.5], ["TS", "단위 테스트", "박개발", 1]], true],
  [0, "REQ0038", "수신 실패 재처리 배치", "중", "중급", "과거 실적", [["DS", "프로그램 설계", "박개발", 1], ["DV", "배치", "박개발", 3], ["TS", "통합·회귀 테스트", "박개발", 1]], true],
  [1, "REQ0051", "알람 등급별 필터", "하", "중급", "WBS 실적", [["DS", "UI 설계", "김개발", 1], ["DV", "UI 개발", "김개발", 3]], false],
  [1, "REQ0012", "설비 상태 조회 조건 추가", "하", "중급", "WBS 실적", [["DV", "UI 개발", "김개발", 1.5], ["TS", "단위 테스트", "김개발", 0.5]], true],
  [1, "REQ0055", "알람 확인 처리 API", "중", "고급", "과거 실적", [["DV", "백엔드 로직 신규", "최개발", 4.5], ["TS", "단위 테스트", "최개발", 1]], true],
  [1, "REQ0058", "알람 이력 테이블 설계", "중", "고급", "WBS 실적", [["DS", "DB 설계", "최개발", 2.5]], true],
  [1, "REQ0060", "알람 통계 화면 신규", "상", "특급", "공수 산정서", [["DS", "UI 설계", "최개발", 2], ["DV", "UI 개발", "최개발", 4], ["TS", "통합·회귀 테스트", "최개발", 1]], false],
  [2, "REQ0021", "조회 화면 엑셀 다운로드", "하", "중급", "WBS 실적", [["DV", "UI 개발", "이개발", 2.5], ["TS", "단위 테스트", "이개발", 0.5]], true],
  [2, "REQ0024", "입고 지연 표시", "하", "초급", "WBS 실적", [["DV", "DB·SQL", "정개발", 2], ["TS", "단위 테스트", "정개발", 0.5]], false],
  [2, "REQ0027", "대용량 다운로드 성능 개선", "상", "중급", "과거 실적", [["DV", "성능 개선", "이개발", 3.5], ["TS", "통합·회귀 테스트", "이개발", 1]], true],
  [3, "REQ0083", "리포트 요구사항 정의", "중", "고급", "공수 산정서", [["AN", "요구사항 분석·정의", "한개발", 2]], true],
  [3, "REQ0081", "월 손익 리포트 화면 전환", "중", "중급", "공수 산정서", [["DV", "코드·플랫폼 전환", "한개발", 6]], false],
  [3, "REQ0085", "리포트 단위 테스트 보강", "하", "초급", "공수 산정서", [["TS", "단위 테스트", "한개발", 1.5]], false],
  // 아래는 측정 전 과제 — 공수 입력이 없으므로 측정 완료로 두지 않는다(결과에 0 시간으로 잡히지 않게).
  [4, "REQ0101", "PM 주기 기준 정의", "중", "고급", "공수 산정서", [["AN", "요구사항 분석·정의", "최개발", 2]], false],
  [4, "REQ0102", "PM 일정 생성 배치", "상", "고급", "공수 산정서", [["DS", "프로그램 설계", "최개발", 1.5], ["DV", "배치", "최개발", 5], ["TS", "통합·회귀 테스트", "최개발", 1.5]], false],
  [4, "REQ0103", "PM 일정 캘린더 화면", "중", "중급", "공수 산정서", [["DS", "UI 설계", "김개발", 1], ["DV", "UI 개발", "김개발", 4], ["TS", "단위 테스트", "김개발", 1]], false],
  [4, "REQ0104", "PM 알림 메일 연계", "하", "중급", "담당자 추정", [["DV", "인터페이스·연계", "박개발", 2]], false],
  [5, "REQ0201", "기존 수율 집계 로직 분석", "상", "특급", "과거 실적", [["AN", "요구사항 분석·정의", "박개발", 2.5]], false],
  [5, "REQ0202", "수율 집계 배치 재구현", "상", "특급", "과거 실적", [["DS", "프로그램 설계", "박개발", 2], ["DV", "배치", "박개발", 7], ["TS", "통합·회귀 테스트", "박개발", 2]], false],
  [5, "REQ0203", "집계 SQL 튜닝", "중", "고급", "WBS 실적", [["DV", "성능 개선", "박개발", 3], ["TS", "단위 테스트", "박개발", 1]], false],
  [6, "REQ0301", "변경 이력 테이블 설계", "중", "고급", "WBS 실적", [["DS", "DB 설계", "최개발", 1.5]], false],
  [6, "REQ0302", "변경 이력 저장 로직", "상", "고급", "WBS 실적", [["DV", "백엔드 로직 수정", "최개발", 4], ["TS", "통합·회귀 테스트", "최개발", 1.5]], false],
  [6, "REQ0303", "이력 조회 화면 (C/S)", "중", "중급", "WBS 실적", [["DV", "UI 개발", "정개발", 3], ["TS", "단위 테스트", "정개발", 0.5]], false],
  [7, "REQ0401", "평가 항목 요구사항 정의", "하", "중급", "공수 산정서", [["AN", "요구사항 분석·정의", "한개발", 1.5]], false],
  [7, "REQ0402", "평가 입력 화면", "하", "중급", "공수 산정서", [["DS", "UI 설계", "한개발", 1], ["DV", "UI 개발", "한개발", 3], ["TS", "단위 테스트", "한개발", 0.5]], false],
  [7, "REQ0403", "평가 결과 조회 API", "하", "초급", "공수 산정서", [["DV", "백엔드 로직 신규", "한개발", 2], ["TS", "단위 테스트", "한개발", 0.5]], false],
  [7, "REQ0404", "평가 집계 리포트", "중", "중급", "공수 산정서", [["DV", "DB·SQL", "한개발", 2.5]], false],
  [8, "REQ0501", "승인 단계 규칙 정리", "중", "고급", "WBS 실적", [["AN", "요구사항 분석·정의", "한개발", 1]], false],
  [8, "REQ0502", "결재선 로직 수정", "중", "고급", "WBS 실적", [["DV", "백엔드 로직 수정", "이개발", 3], ["TS", "통합·회귀 테스트", "이개발", 1]], false],
  [8, "REQ0503", "ERP 연계 전문 변경", "상", "고급", "WBS 실적", [["DS", "인터페이스 설계", "이개발", 1.5], ["DV", "인터페이스·연계", "이개발", 4]], false],
  [9, "REQ0601", "점검 항목 화면 설계", "하", "중급", "담당자 추정", [["DS", "UI 설계", "정개발", 1.5]], false],
  [9, "REQ0602", "점검 결과 입력 화면", "중", "중급", "담당자 추정", [["DV", "UI 개발", "정개발", 4], ["TS", "단위 테스트", "정개발", 1]], false],
  [9, "REQ0603", "오프라인 동기화", "상", "고급", "담당자 추정", [["DS", "프로그램 설계", "이개발", 1.5], ["DV", "백엔드 로직 신규", "이개발", 5], ["TS", "통합·회귀 테스트", "이개발", 1.5]], false],
];

/** [요구사항 ID-단계, 일자 인덱스들, AI 시간 합(h), AI 도구 외 합(h), 작업 유형 순환] — 데모 요구사항 ID 는 과제끼리 겹치지 않는다 */
const PLAN: [string, number[], number, number, ActType[]][] = [
  ["REQ0033-DV", [0, 1, 2, 3], 10.5, 7.5, ["A1", "A3", "A5"]],
  ["REQ0033-TS", [4, 5], 3, 3, ["A2", "A5"]],
  ["REQ0038-DS", [2, 3], 2, 3, ["A3", "A4"]],
  ["REQ0038-DV", [4, 5, 6, 7], 13, 8, ["A1", "A6", "A3"]],
  ["REQ0038-TS", [8], 2.5, 4.5, ["A2", "A4"]],
  ["REQ0055-DV", [0, 1, 2, 3, 4], 22.5, 11.5, ["A1", "A5", "A3"]],
  ["REQ0055-TS", [5, 6], 3.5, 4, ["A2", "A5"]],
  ["REQ0058-DS", [7, 8], 6, 7, ["A4", "A3"]],
  ["REQ0021-DV", [0, 1, 2], 7, 6, ["A1", "A3"]],
  ["REQ0021-TS", [3], 3, 3, ["A2", "A5"]],
  ["REQ0027-DV", [4, 5, 6, 7, 8], 17, 17, ["A1", "A2", "A6"]],
  ["REQ0027-TS", [8], 2.5, 2, ["A2", "A3"]],
  ["REQ0083-AN", [0, 1], 3.5, 6, ["A5", "A4"]],
  ["REQ0024-DV", [3, 4, 5, 6, 7, 8], 9, 5, ["A1", "A3"]],
  ["REQ0081-DV", [2, 3, 4, 5, 6, 7, 8, 9], 15, 13, ["A1", "A1", "A2"]],
  ["REQ0060-DS", [5, 6], 4.5, 6.5, ["A4", "A5"]],
  ["REQ0060-DV", [7, 8, 9], 9.5, 9.5, ["A1", "A3"]],
  ["REQ0047-AN", [0, 1], 2, 3, ["A5", "A4"]],
  ["REQ0047-DV", [0, 1, 2, 3, 4, 5, 6, 7, 8], 19.5, 14.5, ["A5", "A3", "A1"]],
  ["REQ0047-TS", [8, 9], 2, 2, ["A5", "A2"]],
  ["REQ0051-DS", [2, 3, 4, 5], 3.5, 6, ["A4", "A3"]],
  ["REQ0051-DV", [6, 7, 8, 9], 4.5, 2.5, ["A3", "A5"]],
  ["REQ0012-DV", [0, 1, 2], 4, 4, ["A1", "A5"]],
  ["REQ0012-TS", [3], 1.5, 1.5, ["A2", "A4"]],
];

/** 확정하지 않은 채로 남겨 둘 (개발자, 최근 며칠) — '확정 필요' 화면을 보여 주기 위해 */
const UNCONFIRMED_LAST: Record<string, number> = { dev01: 2, dev05: 2 };

// 토큰은 분당 평균치로 만든다 — 실제 Codex 사용량과 비슷한 자릿수가 보이도록.
const demoTokens = (min: number) => ({ "gpt-5-codex": { input: min * 32000, cached: min * 24000, output: min * 1400 } });

export interface SampleData {
  projects: Project[];
  efforts: EffortEntry[];
  confs: DayConf[];
  sessions: AiSession[];
  days: string[];
}

/** 오늘 이전 최근 평일 n 일 (오래된 순) */
export function recentWeekdays(n: number, now = Date.now()): string[] {
  const out: string[] = [];
  let t = now;
  while (out.length < n) {
    t -= 86400000;
    const d = kstDate(t);
    const dow = new Date(d + "T00:00:00Z").getUTCDay();
    if (dow !== 0 && dow !== 6) out.unshift(d);
  }
  return out;
}

export function sampleData(now = Date.now()): SampleData {
  const iso = new Date(now).toISOString();
  const days = recentWeekdays(10, now);
  const projects: Project[] = PRJ.map((p) => ({
    prjId: p[0],
    prjNm: p[1],
    promisCd: "",
    sysNm: p[2],
    deptCd: p[3],
    teamNm: p[4],
    pmNm: p[5],
    sysGrade: p[6],
    deployType: p[7],
    area: p[8],
    vcs: p[9],
    pms: p[10],
    axTeam: p[11],
    axHq: p[12],
    reqs: [],
    regUserId: "admin",
    regAt: iso,
    updUserId: "admin",
    updAt: iso,
  }));
  for (const [pi, reqId, name, diff, grade, src, stages, done] of REQS) {
    const prjId = projects[pi].prjId;
    projects[pi].reqs.push({
      reqId,
      name,
      stages: stages.map(([cd, workType, owner, baseMd]) => ({
        cd,
        workType,
        ownerId: ID_BY_NM[owner] ?? null,
        ownerNm: owner,
        baseMd,
        difficulty: diff,
        grade,
        baseSrc: src,
        done,
        doneAt: done ? days[days.length - 1] : null,
        ...demoFit(unitCode(prjId, reqId, cd), AI_BIAS[prjId] ?? 1),
      })),
    });
  }
  const reqOf = (key: string) => {
    for (const p of projects) for (const r of p.reqs) for (const s of r.stages) if (`${r.reqId}-${s.cd}` === key) return { p, r, s, unit: unitCode(p.prjId, r.reqId, s.cd) };
    throw new Error(key);
  };

  const efforts: EffortEntry[] = [];
  const sessions: AiSession[] = [];
  const touched = new Map<string, { prjId: string; reqId: string; userId: string; date: string }>();
  // 사람·날짜마다 PoC 일을 이어 붙인다 — 하루 종일 한 세션이 아니라 회의·검토 같은 직접 한 일과 Codex 세션이 번갈아, 다른 업무 사이사이에.
  const cursor = new Map<string, number>();
  const at = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const ten = (m: number) => Math.max(10, Math.round(m / 10) * 10);
  // 계획상 PoC 일이 많은 날은 일찍 시작한다 — 자정을 넘기지 않게.
  const planned = new Map<string, number>();
  for (const [key, idxs, aiH, addH] of PLAN) {
    const owner = reqOf(key).s.ownerId!;
    for (const di of idxs) planned.set(`${owner}|${days[di]}`, (planned.get(`${owner}|${days[di]}`) ?? 0) + (aiH + addH) / idxs.length);
  }
  const take = (userId: string, date: string, di: number, len: number, gap: number) => {
    const k = `${userId}|${date}`;
    const seed = di * 37 + userId.charCodeAt(4) * 53;
    // 대개 08:30~10:00 에 시작하고, 가끔 일찍 나온 날도 있다.
    let start = cursor.get(k) ?? ((planned.get(k) ?? 0) > 9 ? 7 * 60 : seed % 7 === 0 ? 7 * 60 + 50 : 8 * 60 + 30 + ten(seed % 90));
    // 점심(12:00~13:00)에 걸치면 오후로 넘긴다.
    if (start < 13 * 60 && (start >= 12 * 60 || (start >= 11 * 60 && start + ten(len) > 12 * 60 + 10))) start = 13 * 60;
    const end = Math.min(23 * 60 + 50, start + ten(len));
    cursor.set(k, Math.min(23 * 60, end + gap));
    return { start: at(start), end: at(end) };
  };
  for (const [key, idxs, aiH, addH, mix] of PLAN) {
    const { p, r, s, unit } = reqOf(key);
    const userId = s.ownerId!;
    idxs.forEach((di, k) => {
      const date = days[di];
      const aiMin = Math.round((aiH / idxs.length) * 60 + ((di * 13) % 9) - 4);
      const dm = Math.round((addH / idxs.length) * 2) * 30;
      // Codex 는 길면 세션을 2~3개로, 직접 입력은 1시간 이상이면 두 유형으로 나눈다.
      const n = aiMin >= 150 ? 3 : aiMin >= 70 ? 2 : aiMin > 0 ? 1 : 0;
      const w = [[1], [0.6, 0.4], [0.45, 0.2, 0.35]][Math.max(0, n - 1)];
      const ai = w.slice(0, n).map((x, j) => (j === n - 1 ? aiMin - w.slice(0, j).reduce((a, y) => a + Math.round(aiMin * y), 0) : Math.round(aiMin * x)));
      const first = dm >= 60 ? ten(dm * (0.35 + ((di + k) % 3) * 0.1)) : dm;
      const direct = (dm >= 60 ? [first, dm - first] : dm > 0 ? [dm] : []).map((m, j) => ({ m, type: mix[(k + j) % mix.length] }));
      const blocks: ({ kind: "ai"; m: number; j: number } | { kind: "direct"; m: number; type: ActType })[] = [];
      for (let x = 0, a = 0, d = 0; a < ai.length || d < direct.length; x++) {
        const wantDirect = (x + di + k) % 2 === 0;
        if ((wantDirect && d < direct.length) || a >= ai.length) blocks.push({ kind: "direct", ...direct[d++] });
        else blocks.push({ kind: "ai", m: ai[a], j: a++ });
      }
      const spans: EffortSpan[] = [];
      blocks.forEach((b, x) => {
        // 늦게까지 이어지는 날은 쉬는 틈 없이 붙인다 — 계획이 많은 날만 야근으로 보이게.
        const gap = (cursor.get(`${userId}|${date}`) ?? 0) >= 16 * 60 ? 0 : 10 + ((di * 7 + k * 11 + x * 13) % 2) * 10;
        if (b.kind === "direct") {
          spans.push({ type: b.type, ...take(userId, date, di, b.m, gap) });
          return;
        }
        // 일부 세션은 과제ID-요구사항ID 만 남겨 '확인 필요'를 만든다(단계가 2개 이상인 요구사항).
        const hints = key === "REQ0051-DV" && k === 1 && b.j === 0 ? [reqKey(p.prjId, r.reqId)] : [unit];
        sessions.push({
          src: "LOG",
          sessionId: `s-${unit}-${di}-${b.j}`,
          userId,
          workDt: date,
          tool: "Codex",
          minutes: b.m,
          // 세션은 시작~끝 사이에 잠깐씩 쉬는 시간이 섞여 활동 시간보다 길다.
          ...take(userId, date, di, b.m + ((di + b.j) % 2) * 10, gap),
          branch: "",
          hints,
          resolution: null,
          tokens: demoTokens(b.m),
          upAt: upAtOf(date),
        });
      });
      if (spans.length) {
        const add: Partial<Record<ActType, number>> = {};
        for (const x of spans) add[x.type] = (add[x.type] ?? 0) + spanMin(x) / 60;
        efforts.push({ unit, prjId: p.prjId, reqId: r.reqId, stage: s.cd, userId, workDt: date, reduceH: 0, add, spans, memo: "" });
      }
      touched.set(`${userId}|${reqKey(p.prjId, r.reqId)}|${date}`, { prjId: p.prjId, reqId: r.reqId, userId, date });
    });
  }
  // 시나리오: 오프라인 AI 사용(A7), 자리 비움 감소, 기타 메모
  efforts.push({ unit: "LMS03-REQ0024-DV", prjId: "LMS03", reqId: "REQ0024", stage: "DV", userId: "dev05", workDt: days[6], reduceH: 0, add: { A7: 2.5, A1: 0.5 }, memo: "" });
  efforts.push({ unit: "MIS05-REQ0081-DV", prjId: "MIS05", reqId: "REQ0081", stage: "DV", userId: "dev06", workDt: days[7], reduceH: 1, add: { A1: 1 }, memo: "" });
  efforts.push({ unit: "DAE01-REQ0033-DV", prjId: "DAE01", reqId: "REQ0033", stage: "DV", userId: "dev02", workDt: days[3], reduceH: 0, add: { A8: 1 }, memo: "보안 점검 대응 자료 작성" });
  // 시나리오: 공수 태그 없이 잡힌 AI 사용 — 하나는 토큰 미수집이라 비용 빈칸
  sessions.push({ src: "LOG", sessionId: "s-main-1", userId: "dev01", workDt: days[8], tool: "Codex", minutes: 45, start: "10:05", end: "10:50", branch: "main", hints: [], resolution: null, tokens: demoTokens(45), upAt: upAtOf(days[8]) });
  sessions.push({ src: "LOG", sessionId: "s-main-2", userId: "dev05", workDt: days[8], tool: "Codex", minutes: 40, start: "13:30", end: "14:10", branch: "main", hints: [], resolution: null, upAt: upAtOf(days[8]) });

  const confs: DayConf[] = [];
  touched.forEach((t) => {
    const last = UNCONFIRMED_LAST[t.userId] ?? 0;
    if (last && days.indexOf(t.date) >= days.length - last) return;
    // 대부분 다음 날 오전에 확정, 최개발은 사흘 뒤 몰아서 — 다음 날 확정률이 100% 로만 보이지 않게
    const lag = t.userId === "dev03" ? 3 : 1;
    const at = new Date(Math.min(now, Date.parse(`${t.date}T00:30:00Z`) + lag * 86400000)).toISOString();

    confs.push({ userId: t.userId, prjId: t.prjId, reqId: t.reqId, workDt: t.date, state: "CONF", confirmedAt: at, firstConfirmedAt: at, revCount: 0, snap: {} });
  });
  return { projects, efforts, confs, sessions, days };
}
