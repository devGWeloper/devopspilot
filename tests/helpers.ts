import type { ActorFull } from "@/lib/auth/permissions";
import type { Project, Requirement, Stage } from "@/lib/types";

export const admin: ActorFull = { userId: "admin", role: "ADMIN", userNm: "관리자", orgCd: "SKAX" };
export const dev1: ActorFull = { userId: "dev01", role: "DEVELOPER", userNm: "김개발", orgCd: "SKAX" };
export const dev2: ActorFull = { userId: "dev02", role: "DEVELOPER", userNm: "박개발", orgCd: "SKAX" };
export const viewer: ActorFull = { userId: "view01", role: "VIEWER", userNm: "열람", orgCd: "SKHYNIX" };

export function mkStage(p: Partial<Stage> = {}): Stage {
  return { cd: "DV", workType: "UI 개발", ownerId: "dev01", ownerNm: "김개발", baseMd: 2, ...p };
}

export function mkReq(p: Partial<Requirement> = {}): Requirement {
  return { reqId: "REQ-0001", name: "요구사항", difficulty: "중", grade: "중급", baseSrc: "WBS 실적", stages: [mkStage()], done: false, doneAt: null, extra: {}, ...p };
}

export function mkProject(partial: Partial<Project> = {}): Project {
  return {
    prjId: "PRJ-0001",
    prjNm: "과제",
    sysNm: "시스템",
    kind: "개발",
    deptCd: "MES",
    teamNm: "팀",
    axTeam: "",
    pmNm: "PM",
    sysGrade: "L2",
    deployType: "",
    area: "",
    wbsYn: "",
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
