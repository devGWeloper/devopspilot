// 데모 데이터 — 목업 v17 의 과제·요구사항을 옮기고, 일자는 실행 시점 기준 최근 평일로 맞춘다(언제 띄워도 '진행 중'으로 보이게).
import { kstDate } from "../measure/ingest";
import type { ActType, AiSession, DayConf, EffortEntry } from "../measure/types";
import type { PrjKind, Project, Requirement, StageCd } from "../types";

const FIT_OPTS = {
  spec: ["명확", "일부 명확", "모호"],
  ctx: ["가능", "일부 가능", "어려움"],
  gen: ["패턴 반복", "패턴 변형", "신규 설계 판단"],
};
const LV = ["상", "중", "하"];

/** 난이도를 바탕으로 요구사항마다 조금씩 다른 적합도 평가를 만든다(분포 화면이 비지 않게). */
function demoFit(reqId: string, diff: string): Record<string, string> {
  const n = Number(reqId.replace(/\D/g, ""));
  const base = diff === "하" ? 0 : diff === "중" ? 1 : 2;
  const pick = (k: number) => Math.min(2, Math.max(0, base + ((n + k) % 3 === 0 ? 1 : (n + k) % 5 === 0 ? -1 : 0)));
  const [s, c, g] = [pick(0), pick(1), pick(2)];
  const worst = Math.max(s, c, g);
  const label = ["명세", "맥락", "생성"][[s, c, g].indexOf(worst)];
  const ref = worst === 0 ? "상" : `${LV[worst]} (${label})`;
  const fin = LV[Math.min(2, Math.max(0, worst + (n % 7 === 0 ? -1 : 0)))];
  return { "FIT-01": FIT_OPTS.spec[s], "FIT-02": FIT_OPTS.ctx[c], "FIT-03": FIT_OPTS.gen[g], "FIT-05": ref, "FIT-06": fin, "REF-02": n % 4 === 0 ? "시범·개인 사용" : "실무 상시 사용" };
}

export const DEMO_DEVS: [string, string, string][] = [
  ["dev01", "김개발", "AX MES개발1팀"],
  ["dev02", "박개발", "AX MES개발1팀"],
  ["dev03", "최개발", "AX MES개발2팀"],
  ["dev04", "이개발", "AX 물류DX팀"],
  ["dev05", "정개발", "AX 물류DX팀"],
  ["dev06", "한개발", "AX 경영DX팀"],
];
const ID_BY_NM = Object.fromEntries(DEMO_DEVS.map(([id, nm]) => [nm, id]));

type P = [string, string, string, string, string, string, string, string, string, string, string, PrjKind, string];
const PRJ: P[] = [
  ["설비 이벤트 수신 통합", "FAB MOS", "MES", "FAB MOS팀", "이영희", "L1", "서버 전용 (UI 없음)", "기능 개선", "있음", "Bitbucket", "Jira", "개발", "AX MES개발1팀"],
  ["품질 알람 고도화", "smartMES", "MES", "품질시스템팀", "홍길동", "L2", "Web — On-Premise", "기능 개선", "있음", "Bitbucket", "Jira", "개발", "AX MES개발2팀"],
  ["물류 조회 화면 개선", "LMS", "MES", "물류시스템팀", "박민수", "L3", "Web — On-Premise", "기능 개선", "있음", "GitLab", "Redmine", "개발", "AX 물류DX팀"],
  ["MES 운영 개선 요청", "FAB MOS", "MES", "MES운영팀", "정수진", "L1", "복합", "기능 개선", "있음", "Bitbucket", "사내 작업관리 시스템", "운영", "AX MES운영팀"],
  ["경영 리포트 전환", "MIS Portal", "MIS", "경영정보팀", "최현우", "L3", "Web — Cloud", "전환", "없음", "GitHub", "Jira", "개발", "AX 경영DX팀"],
  ["물류 운영 SR 처리", "LMS", "MES", "물류운영팀", "박민수", "L3", "Web — On-Premise", "기능 개선", "있음", "GitLab", "사내 작업관리 시스템", "운영", "AX 물류DX팀"],
];

type S = [StageCd, string, string, number];
type R = [number, string, string, string, string, string, S[], boolean, string];
const REQS: R[] = [
  [0, "REQ-0047", "설비 이벤트 수신 로직 변경", "상", "고급", "WBS 실적", [["AN", "요구사항 분석·정의", "박개발", 1], ["DV", "인터페이스·연계", "김개발", 5.5], ["TS", "통합·회귀 테스트", "김개발", 1.5]], false, "Claude Code"],
  [0, "REQ-0033", "중복 이벤트 처리", "중", "중급", "WBS 실적", [["DV", "백엔드 로직 수정", "박개발", 3.5], ["TS", "단위 테스트", "박개발", 1]], true, "Claude Code"],
  [0, "REQ-0038", "수신 실패 재처리 배치", "중", "중급", "WBS 실적", [["DS", "프로그램 설계", "박개발", 1], ["DV", "배치", "박개발", 3], ["TS", "통합·회귀 테스트", "박개발", 1]], true, "Codex"],
  [1, "REQ-0051", "알람 등급별 필터", "하", "중급", "WBS 실적", [["DS", "UI 설계", "김개발", 1], ["DV", "UI 개발", "김개발", 3]], false, "Claude Code"],
  [1, "REQ-0012", "설비 상태 조회 조건 추가", "하", "중급", "WBS 실적", [["DV", "UI 개발", "김개발", 1.5], ["TS", "단위 테스트", "김개발", 0.5]], true, "Claude Code"],
  [1, "REQ-0055", "알람 확인 처리 API", "중", "고급", "WBS 실적", [["DV", "백엔드 로직 신규", "최개발", 4.5], ["TS", "단위 테스트", "최개발", 1]], true, "Claude Code"],
  [1, "REQ-0058", "알람 이력 테이블 설계", "중", "고급", "WBS 실적", [["DS", "DB 설계", "최개발", 2.5]], true, "Claude Code"],
  [1, "REQ-0060", "알람 통계 화면 신규", "상", "특급", "WBS 실적", [["DS", "UI 설계", "최개발", 2], ["DV", "UI 개발", "최개발", 4], ["TS", "통합·회귀 테스트", "최개발", 1]], false, "Claude Code"],
  [2, "REQ-0021", "조회 화면 엑셀 다운로드", "하", "중급", "WBS 실적", [["DV", "UI 개발", "이개발", 2.5], ["TS", "단위 테스트", "이개발", 0.5]], true, "Claude Code"],
  [2, "REQ-0024", "입고 지연 표시", "하", "초급", "WBS 실적", [["DV", "DB·SQL", "정개발", 2], ["TS", "단위 테스트", "정개발", 0.5]], false, "Codex"],
  [2, "REQ-0027", "대용량 다운로드 성능 개선", "상", "중급", "WBS 실적", [["DV", "성능 개선", "이개발", 3.5], ["TS", "통합·회귀 테스트", "이개발", 1]], true, "Claude Code"],
  [3, "REQ-0071", "설비 코드 매핑 변경", "하", "중급", "담당자 추정", [["DV", "DB·SQL", "박개발", 1], ["TS", "단위 테스트", "박개발", 0.3], ["DP", "배포·이행", "박개발", 0.2]], true, "Claude Code"],
  [3, "REQ-0072", "일 마감 배치 오류 수정", "중", "고급", "담당자 추정", [["DV", "배치", "최개발", 1], ["TS", "통합·회귀 테스트", "최개발", 0.5], ["OP", "장애 분석·조치", "최개발", 0.5]], true, "Claude Code"],
  [3, "REQ-0073", "조회 권한 추가", "하", "초급", "담당자 추정", [["DV", "백엔드 로직 수정", "정개발", 0.8], ["DP", "배포·이행", "정개발", 0.2]], false, "Codex"],
  [3, "REQ-0074", "알람 수신자 변경", "하", "초급", "담당자 추정", [["DV", "백엔드 로직 수정", "김개발", 0.3], ["DP", "배포·이행", "김개발", 0.2]], true, "Claude Code"],
  [4, "REQ-0083", "리포트 요구사항 정의", "중", "고급", "공수 산정서", [["AN", "요구사항 분석·정의", "한개발", 2]], true, "사내 소스코딩 에이전트"],
  [4, "REQ-0081", "월 손익 리포트 화면 전환", "중", "중급", "공수 산정서", [["DV", "코드·플랫폼 전환", "한개발", 6]], false, "사내 소스코딩 에이전트"],
  [4, "REQ-0085", "리포트 단위 테스트 보강", "하", "초급", "공수 산정서", [["TS", "단위 테스트", "한개발", 1.5]], false, "사내 소스코딩 에이전트"],
  [5, "REQ-0092", "입고 데이터 보정", "하", "초급", "담당자 추정", [["OP", "데이터 조치", "정개발", 1]], true, "Codex"],
  [5, "REQ-0093", "라벨 출력 오류 수정", "중", "중급", "담당자 추정", [["DV", "백엔드 로직 수정", "이개발", 0.7], ["TS", "단위 테스트", "이개발", 0.3], ["OP", "장애 분석·조치", "이개발", 0.5]], true, "Claude Code"],
  [5, "REQ-0094", "출고 지연 알림 추가", "하", "초급", "담당자 추정", [["DV", "배치", "정개발", 0.8], ["DP", "배포·이행", "정개발", 0.2]], false, "Codex"],
];

/** [단위, 일자 인덱스들, AI 시간 합(h), AI 도구 외 합(h), 작업 유형 순환] */
const PLAN: [string, number[], number, number, ActType[]][] = [
  ["REQ-0033-DV", [0, 1, 2, 3], 13, 5, ["A1", "A3", "A5"]],
  ["REQ-0033-TS", [4, 5], 4, 2, ["A2"]],
  ["REQ-0038-DS", [2, 3], 3, 2, ["A3", "A4"]],
  ["REQ-0038-DV", [4, 5, 6, 7], 14, 7, ["A1", "A6", "A3"]],
  ["REQ-0038-TS", [8], 4, 3, ["A2"]],
  ["REQ-0055-DV", [0, 1, 2, 3, 4], 22, 12, ["A1", "A5", "A3"]],
  ["REQ-0055-TS", [5, 6], 4, 3.5, ["A2", "A5"]],
  ["REQ-0058-DS", [7, 8], 7, 6, ["A4", "A3"]],
  ["REQ-0021-DV", [0, 1, 2], 9, 4, ["A1", "A3"]],
  ["REQ-0021-TS", [3], 3, 3, ["A2"]],
  ["REQ-0027-DV", [4, 5, 6, 7, 8], 24, 10, ["A1", "A2", "A6"]],
  ["REQ-0027-TS", [8], 2, 2.5, ["A2"]],
  ["REQ-0071-DV", [6], 4, 2, ["A6"]],
  ["REQ-0071-TS", [7], 1, 1, ["A2"]],
  ["REQ-0071-DP", [8], 0.5, 1, ["A6"]],
  ["REQ-0072-OP", [2], 1.5, 1.5, ["A3"]],
  ["REQ-0072-DV", [3, 4], 5, 2, ["A3", "A1"]],
  ["REQ-0072-TS", [5], 1.5, 1.5, ["A2"]],
  ["REQ-0083-AN", [0, 1], 6, 3.5, ["A5", "A4"]],
  ["REQ-0024-DV", [3, 4, 5, 6, 7, 8], 10, 4, ["A1", "A3"]],
  ["REQ-0073-DV", [7, 8, 9], 3, 1, ["A6"]],
  ["REQ-0081-DV", [2, 3, 4, 5, 6, 7, 8, 9], 20, 8, ["A1", "A1", "A2"]],
  ["REQ-0060-DS", [5, 6], 8, 3, ["A4", "A5"]],
  ["REQ-0060-DV", [7, 8, 9], 15, 4, ["A1", "A3"]],
  ["REQ-0092-OP", [5], 1.5, 0, ["A6"]],
  ["REQ-0093-OP", [6], 1, 2, ["A3", "A5"]],
  ["REQ-0093-DV", [7], 1, 4, ["A1", "A5"]],
  ["REQ-0093-TS", [8], 0.5, 2, ["A2"]],
  ["REQ-0047-AN", [0, 1], 3, 2, ["A5", "A4"]],
  ["REQ-0047-DV", [0, 1, 2, 3, 4, 5, 6, 7, 8], 30, 4, ["A5", "A3", "A1"]],
  ["REQ-0047-TS", [8, 9], 3.5, 0.5, ["A5"]],
  ["REQ-0051-DS", [2, 3, 4, 5], 7.5, 2, ["A4", "A3"]],
  ["REQ-0051-DV", [6, 7, 8, 9], 6.5, 0.5, ["A3"]],
  ["REQ-0012-DV", [0, 1, 2], 6, 2, ["A1"]],
  ["REQ-0012-TS", [3], 2, 1, ["A2"]],
  ["REQ-0074-DV", [1], 2, 0.5, ["A6"]],
  ["REQ-0074-DP", [2], 0.5, 0.5, ["A6"]],
];

/** 확정하지 않은 채로 남겨 둘 (개발자, 최근 며칠) — '확정 필요' 화면을 보여 주기 위해 */
const UNCONFIRMED_LAST: Record<string, number> = { dev01: 2, dev05: 2 };

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
  const projects: Project[] = PRJ.map((p, i) => ({
    prjId: `PRJ-${String(i + 1).padStart(4, "0")}`,
    prjNm: p[0],
    sysNm: p[1],
    deptCd: p[2],
    teamNm: p[3],
    pmNm: p[4],
    sysGrade: p[5],
    deployType: p[6],
    area: p[7],
    wbsYn: p[8],
    vcs: p[9],
    pms: p[10],
    kind: p[11],
    axTeam: p[12],
    reqs: [],
    regUserId: "admin",
    regAt: iso,
    updUserId: "admin",
    updAt: iso,
  }));
  const toolOf = new Map<string, string>();
  for (const [pi, reqId, name, diff, grade, src, stages, done, tool] of REQS) {
    const req: Requirement = {
      reqId,
      name,
      difficulty: diff,
      grade,
      baseSrc: src,
      stages: stages.map(([cd, workType, owner, baseMd]) => ({ cd, workType, ownerId: ID_BY_NM[owner] ?? null, ownerNm: owner, baseMd })),
      done,
      doneAt: done ? iso : null,
      extra: { "AIS-01": tool.startsWith("사내") ? "사내 LLM" : "Public LLM (외부)", "AIS-02": tool, ...demoFit(reqId, diff) },
    };
    projects[pi].reqs.push(req);
    toolOf.set(reqId, tool);
  }
  const reqOf = (unit: string) => {
    for (const p of projects) for (const r of p.reqs) for (const s of r.stages) if (`${r.reqId}-${s.cd}` === unit) return { p, r, s };
    throw new Error(unit);
  };

  const efforts: EffortEntry[] = [];
  const sessions: AiSession[] = [];
  const touched = new Map<string, { prjId: string; reqId: string; userId: string; date: string }>();
  for (const [unit, idxs, aiH, addH, mix] of PLAN) {
    const { p, r, s } = reqOf(unit);
    const userId = s.ownerId!;
    idxs.forEach((di, k) => {
      const date = days[di];
      const aiMin = Math.round((aiH / idxs.length) * 60 + ((di * 13) % 9) - 4);
      const h = Math.round((addH / idxs.length) * 2) / 2;
      // 일부 세션은 요구사항 ID 만 남겨 '확인 필요'를 만든다(단계가 2개 이상인 요구사항).
      const hints = unit === "REQ-0051-DV" && k === 1 ? ["REQ-0051"] : [unit];
      if (aiMin > 0)
        sessions.push({
          src: "OTEL",
          sessionId: `s-${unit}-${di}`,
          userId,
          workDt: date,
          tool: toolOf.get(r.reqId) ?? "Claude Code",
          minutes: aiMin,
          start: "09:30",
          end: "17:40",
          branch: `feature/${r.reqId.toLowerCase()}`,
          hints,
          resolution: null,
        });
      if (h > 0) {
        const t = mix[k % mix.length];
        efforts.push({ unit, prjId: p.prjId, reqId: r.reqId, stage: s.cd, userId, workDt: date, reduceH: 0, add: { [t]: h }, memo: "" });
      }
      touched.set(`${userId}|${r.reqId}|${date}`, { prjId: p.prjId, reqId: r.reqId, userId, date });
    });
  }
  // 시나리오: 오프라인 AI 사용(A7), 자리 비움 감소, 기타 메모
  efforts.push({ unit: "REQ-0024-DV", prjId: "PRJ-0003", reqId: "REQ-0024", stage: "DV", userId: "dev05", workDt: days[6], reduceH: 0, add: { A7: 2.5, A1: 0.5 }, memo: "" });
  efforts.push({ unit: "REQ-0081-DV", prjId: "PRJ-0005", reqId: "REQ-0081", stage: "DV", userId: "dev06", workDt: days[7], reduceH: 1, add: { A1: 1 }, memo: "" });
  efforts.push({ unit: "REQ-0033-DV", prjId: "PRJ-0001", reqId: "REQ-0033", stage: "DV", userId: "dev02", workDt: days[3], reduceH: 0, add: { A8: 1 }, memo: "보안 점검 대응 자료 작성" });
  // 시나리오: 요구사항 정보 없이 잡힌 AI 사용
  sessions.push({ src: "LOG", sessionId: "s-main-1", userId: "dev01", workDt: days[8], tool: "Codex", minutes: 45, start: "10:05", end: "10:50", branch: "main", hints: [], resolution: null });
  sessions.push({ src: "LOG", sessionId: "s-main-2", userId: "dev05", workDt: days[8], tool: "Codex", minutes: 40, start: "13:30", end: "14:10", branch: "main", hints: [], resolution: null });

  const confs: DayConf[] = [];
  touched.forEach((t) => {
    const last = UNCONFIRMED_LAST[t.userId] ?? 0;
    if (last && days.indexOf(t.date) >= days.length - last) return;
    confs.push({ userId: t.userId, prjId: t.prjId, reqId: t.reqId, workDt: t.date, state: "CONF", confirmedAt: iso, revCount: 0, snap: {} });
  });
  return { projects, efforts, confs, sessions, days };
}
