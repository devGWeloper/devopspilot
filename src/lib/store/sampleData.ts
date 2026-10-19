// 데모 데이터 — 목업 v17 의 과제·요구사항을 옮기고, 일자는 실행 시점 기준 최근 평일로 맞춘다(언제 띄워도 '진행 중'으로 보이게).
import { kstDate } from "../measure/ingest";
import type { ActType, AiSession, DayConf, EffortEntry } from "../measure/types";
import { reqKey, unitCode } from "../measure/units";
import type { Project, StageCd } from "../types";

const LV = ["상", "중", "하"];

/** 난이도를 바탕으로 단계마다 조금씩 다른 적합도 평가를 만든다(분포 화면이 비지 않게). */
function demoFit(code: string, diff: string): { fit: string; spec: string; ctx: string; gen: string } {
  const n = Array.from(code).reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = diff === "상" ? 0 : diff === "중" ? 1 : 2;
  const pick = (k: number) => LV[Math.min(2, Math.max(0, base + ((n + k) % 3 === 0 ? 1 : (n + k) % 5 === 0 ? -1 : 0)))];
  return { spec: pick(0), ctx: pick(1), gen: pick(2), fit: pick(3) };
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
];

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
];

/** [요구사항 ID-단계, 일자 인덱스들, AI 시간 합(h), AI 도구 외 합(h), 작업 유형 순환] — 데모 요구사항 ID 는 과제끼리 겹치지 않는다 */
const PLAN: [string, number[], number, number, ActType[]][] = [
  ["REQ0033-DV", [0, 1, 2, 3], 13, 5, ["A1", "A3", "A5"]],
  ["REQ0033-TS", [4, 5], 4, 2, ["A2"]],
  ["REQ0038-DS", [2, 3], 3, 2, ["A3", "A4"]],
  ["REQ0038-DV", [4, 5, 6, 7], 14, 7, ["A1", "A6", "A3"]],
  ["REQ0038-TS", [8], 4, 3, ["A2"]],
  ["REQ0055-DV", [0, 1, 2, 3, 4], 22, 12, ["A1", "A5", "A3"]],
  ["REQ0055-TS", [5, 6], 4, 3.5, ["A2", "A5"]],
  ["REQ0058-DS", [7, 8], 7, 6, ["A4", "A3"]],
  ["REQ0021-DV", [0, 1, 2], 9, 4, ["A1", "A3"]],
  ["REQ0021-TS", [3], 3, 3, ["A2"]],
  ["REQ0027-DV", [4, 5, 6, 7, 8], 24, 10, ["A1", "A2", "A6"]],
  ["REQ0027-TS", [8], 2, 2.5, ["A2"]],
  ["REQ0083-AN", [0, 1], 6, 3.5, ["A5", "A4"]],
  ["REQ0024-DV", [3, 4, 5, 6, 7, 8], 10, 4, ["A1", "A3"]],
  ["REQ0081-DV", [2, 3, 4, 5, 6, 7, 8, 9], 20, 8, ["A1", "A1", "A2"]],
  ["REQ0060-DS", [5, 6], 8, 3, ["A4", "A5"]],
  ["REQ0060-DV", [7, 8, 9], 15, 4, ["A1", "A3"]],
  ["REQ0047-AN", [0, 1], 3, 2, ["A5", "A4"]],
  ["REQ0047-DV", [0, 1, 2, 3, 4, 5, 6, 7, 8], 30, 4, ["A5", "A3", "A1"]],
  ["REQ0047-TS", [8, 9], 3.5, 0.5, ["A5"]],
  ["REQ0051-DS", [2, 3, 4, 5], 7.5, 2, ["A4", "A3"]],
  ["REQ0051-DV", [6, 7, 8, 9], 6.5, 0.5, ["A3"]],
  ["REQ0012-DV", [0, 1, 2], 6, 2, ["A1"]],
  ["REQ0012-TS", [3], 2, 1, ["A2"]],
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
        ...demoFit(unitCode(prjId, reqId, cd), diff),
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
  for (const [key, idxs, aiH, addH, mix] of PLAN) {
    const { p, r, s, unit } = reqOf(key);
    const userId = s.ownerId!;
    idxs.forEach((di, k) => {
      const date = days[di];
      const aiMin = Math.round((aiH / idxs.length) * 60 + ((di * 13) % 9) - 4);
      const h = Math.round((addH / idxs.length) * 2) / 2;
      // 일부 세션은 과제ID-요구사항ID 만 남겨 '확인 필요'를 만든다(단계가 2개 이상인 요구사항).
      const hints = key === "REQ0051-DV" && k === 1 ? [reqKey(p.prjId, r.reqId)] : [unit];
      if (aiMin > 0)
        sessions.push({
          src: "OTEL",
          sessionId: `s-${unit}-${di}`,
          userId,
          workDt: date,
          tool: "Codex",
          minutes: aiMin,
          start: "09:30",
          end: "17:40",
          branch: "",
          hints,
          resolution: null,
          tokens: demoTokens(aiMin),
        });
      if (h > 0) {
        const t = mix[k % mix.length];
        efforts.push({ unit, prjId: p.prjId, reqId: r.reqId, stage: s.cd, userId, workDt: date, reduceH: 0, add: { [t]: h }, memo: "" });
      }
      touched.set(`${userId}|${reqKey(p.prjId, r.reqId)}|${date}`, { prjId: p.prjId, reqId: r.reqId, userId, date });
    });
  }
  // 시나리오: 오프라인 AI 사용(A7), 자리 비움 감소, 기타 메모
  efforts.push({ unit: "LMS03-REQ0024-DV", prjId: "LMS03", reqId: "REQ0024", stage: "DV", userId: "dev05", workDt: days[6], reduceH: 0, add: { A7: 2.5, A1: 0.5 }, memo: "" });
  efforts.push({ unit: "MIS05-REQ0081-DV", prjId: "MIS05", reqId: "REQ0081", stage: "DV", userId: "dev06", workDt: days[7], reduceH: 1, add: { A1: 1 }, memo: "" });
  efforts.push({ unit: "DAE01-REQ0033-DV", prjId: "DAE01", reqId: "REQ0033", stage: "DV", userId: "dev02", workDt: days[3], reduceH: 0, add: { A8: 1 }, memo: "보안 점검 대응 자료 작성" });
  // 시나리오: 공수 태그 없이 잡힌 AI 사용 — 하나는 토큰 미수집이라 비용 빈칸
  sessions.push({ src: "LOG", sessionId: "s-main-1", userId: "dev01", workDt: days[8], tool: "Codex", minutes: 45, start: "10:05", end: "10:50", branch: "main", hints: [], resolution: null, tokens: demoTokens(45) });
  sessions.push({ src: "LOG", sessionId: "s-main-2", userId: "dev05", workDt: days[8], tool: "Codex", minutes: 40, start: "13:30", end: "14:10", branch: "main", hints: [], resolution: null });

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
