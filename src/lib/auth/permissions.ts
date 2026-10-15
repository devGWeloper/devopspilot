// Edge 미들웨어·클라이언트·서버가 모두 import 하므로 Node 전용 모듈을 가져오지 않는다.
import type { OrgCd, Requirement, Role } from "../types";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "관리자",
  DEVELOPER: "개발자",
  VIEWER: "열람자",
};

export const ROLE_DESC: Record<Role, string> = {
  ADMIN: "과제·요구사항 입력, 전체 조회, 시스템 관리",
  DEVELOPER: "내 담당 단계의 공수 입력·확정",
  VIEWER: "현황·측정 결과 조회",
};

export interface Actor {
  userId: string;
  role: Role;
}

export type ActorFull = Actor & { userNm: string; orgCd: OrgCd };

export type Action = "project.manage" | "users.manage" | "settings.manage" | "history.view" | "effort.edit" | "effort.upload";

export function can(actor: Actor, action: Action, ctx: { req?: Requirement; ownerId?: string | null } = {}): boolean {
  switch (action) {
    case "effort.edit":
      // 관리자도 대신 입력하지 않는다 — 확정은 본인 확인이라는 의미가 있어서.
      if (actor.role !== "DEVELOPER") return false;
      if (ctx.ownerId !== undefined) return ctx.ownerId === actor.userId;
      return !!ctx.req && ctx.req.stages.some((s) => s.ownerId === actor.userId);
    case "effort.upload":
      return actor.role === "DEVELOPER";
    default:
      return actor.role === "ADMIN";
  }
}

/** 요구사항을 볼 수 있는지 — 개발자는 내 담당 단계가 있는 요구사항만 */
export function canSee(actor: Actor, req: Requirement): boolean {
  if (actor.role !== "DEVELOPER") return true;
  return req.stages.some((s) => s.ownerId === actor.userId);
}

const PATH_RULES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/api/admin", roles: ["ADMIN"] },
];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const rule = PATH_RULES.find((r) => matches(pathname, r.prefix));
  return rule ? rule.roles.includes(role) : true;
}

export function homePathFor(role: Role): string {
  return role === "DEVELOPER" ? "/effort" : "/";
}
