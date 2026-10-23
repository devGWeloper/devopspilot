import type { ActorFull } from "@/lib/auth/permissions";
import type { TokenUse } from "@/lib/measure/types";
import type { Project, Requirement, Stage, UserRecord } from "@/lib/types";

export const admin: ActorFull = { userId: "admin", role: "ADMIN", userNm: "관리자", orgCd: "SKAX" };
export const dev1: ActorFull = { userId: "dev01", role: "DEVELOPER", userNm: "김개발", orgCd: "SKAX" };
export const dev2: ActorFull = { userId: "dev02", role: "DEVELOPER", userNm: "박개발", orgCd: "SKAX" };
export const viewer: ActorFull = { userId: "view01", role: "VIEWER", userNm: "열람", orgCd: "SKHYNIX" };

export function mkStage(p: Partial<Stage> = {}): Stage {
  return {
    cd: "DV",
    workType: "UI 개발",
    ownerId: "dev01",
    ownerNm: "김개발",
    baseMd: 2,
    difficulty: "중",
    grade: "중급",
    baseSrc: "과거 실적",
    done: false,
    doneAt: null,
    fit: "",
    spec: "",
    ctx: "",
    gen: "",
    ...p,
  };
}

export function mkReq(p: Partial<Requirement> = {}): Requirement {
  return { reqId: "REQ0001", name: "요구사항", stages: [mkStage()], ...p };
}

export function mkProject(partial: Partial<Project> = {}): Project {
  return {
    prjId: "DAE01",
    prjNm: "과제",
    promisCd: "",
    sysNm: "시스템",
    deptCd: "MES",
    teamNm: "팀",
    axHq: "",
    axTeam: "",
    pmNm: "PM",
    sysGrade: "L2",
    deployType: "",
    area: "",
    vcs: "",
    pms: "",
    reqs: [mkReq()],
    regUserId: "admin",
    regAt: "2026-10-01T00:00:00.000Z",
    updUserId: "admin",
    updAt: "2026-10-01T00:00:00.000Z",
    ...partial,
  };
}

/** 브라우저가 세션 파일에서 만든 요약과 같은 모양 — uploadLog 에 그대로 넘긴다 */
export function sessionFile(sessionId: string, date: string, activeMin: number, hints: string[] = [], tokens?: Record<string, TokenUse>) {
  return { format: "poc-ai-sessions", version: 3, sessions: [{ tool: "Codex", sessionId, date, start: "10:00", end: "11:00", activeMin, branch: "", hints, ...(tokens ? { tokens } : {}) }] };
}

export function mkUser(userId: string, userNm: string, p: Partial<UserRecord> = {}): UserRecord {
  return { userId, userNm, orgCd: "SKAX", hqNm: "", deptNm: "", role: "DEVELOPER", aiAcct: "", useYn: true, pwdHash: "x", pwdSalt: "x", lastLoginAt: null, regAt: "", updAt: "", ...p };
}
