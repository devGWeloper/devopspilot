// Edge 미들웨어·클라이언트·서버가 모두 import 하므로 Node 전용 모듈을 가져오지 않는다.
import type { OrgCd, Project, Role } from "../types";

export const ROLE_LABEL: Record<Role, string> = {
  AX_ADMIN: "AX 관리자",
  HX_REVIEWER: "HX 검토자",
  PM: "과제 PM",
  DEVELOPER: "개발자",
  TESTER: "테스트 수행자",
  VIEWER: "열람자",
};

export interface Actor {
  userId: string;
  role: Role;
}

export type ActorFull = Actor & { userNm: string; orgCd: OrgCd };

export type Action =
  | "project.create"
  | "project.edit"
  | "project.submit"
  | "project.status"
  | "project.confirm"
  | "project.review"
  | "criteria.manage"
  | "codes.manage"
  | "users.manage"
  | "history.view"
  | "export"
  | "ai.use"
  | "measure.feature"
  | "measure.effort"
  | "measure.defect"
  | "measure.upload.usage"
  | "measure.upload.commit"
  | "measure.settings"
  | "measure.comment";

export interface PermissionContext {
  project?: Pick<Project, "pmUserId" | "status">;
  feature?: { devUserId: string | null };
}

const EDITABLE = new Set(["DRAFT", "SUPPLEMENT"]);

export function can(actor: Actor, action: Action, ctx: PermissionContext = {}): boolean {
  const { role, userId } = actor;
  const p = ctx.project;
  const ownProject = !!p && p.pmUserId === userId;
  const measuring = !!p && p.status === "SELECTED";

  switch (action) {
    case "project.submit":
      if (!p || !EDITABLE.has(p.status)) return false;
      return role === "AX_ADMIN" || (role === "PM" && ownProject);
    case "project.edit":
      if (role === "AX_ADMIN") return true;
      return role === "PM" && ownProject && EDITABLE.has(p!.status);
    case "project.create":
      return role === "AX_ADMIN" || role === "PM";
    case "project.review":
    case "measure.comment":
      return role === "AX_ADMIN" || role === "HX_REVIEWER";
    case "export":
      return role !== "VIEWER";
    case "measure.feature":
    case "measure.upload.commit":
      if (role === "AX_ADMIN") return true;
      return role === "PM" && ownProject && measuring;
    case "measure.effort":
      if (role === "AX_ADMIN") return true;
      return role === "DEVELOPER" && measuring && !!ctx.feature && ctx.feature.devUserId === userId;
    case "measure.defect":
      if (role === "AX_ADMIN") return true;
      return role === "TESTER" && measuring;
    case "measure.upload.usage":
      if (role === "AX_ADMIN") return true;
      return role === "DEVELOPER" && measuring;
    default:
      return role === "AX_ADMIN";
  }
}

interface PathRule {
  prefix: string;
  roles: Role[];
}

const PATH_RULES: PathRule[] = [
  { prefix: "/admin", roles: ["AX_ADMIN"] },
  { prefix: "/api/admin", roles: ["AX_ADMIN"] },
  { prefix: "/entry", roles: ["AX_ADMIN", "PM"] },
  { prefix: "/today", roles: ["AX_ADMIN", "DEVELOPER"] },
  { prefix: "/collect", roles: ["AX_ADMIN", "PM", "DEVELOPER"] },
  { prefix: "/check", roles: ["AX_ADMIN", "PM"] },
  { prefix: "/defects", roles: ["AX_ADMIN", "TESTER", "HX_REVIEWER", "PM"] },
];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function canAccessPath(role: Role, pathname: string): boolean {
  const rule = PATH_RULES.find((r) => matches(pathname, r.prefix));
  return rule ? rule.roles.includes(role) : true;
}

export function homePathFor(role: Role): string {
  if (role === "DEVELOPER") return "/today";
  if (role === "TESTER") return "/defects";
  if (role === "PM") return "/entry";
  return "/";
}

export function reviewSide(actor: Actor & { orgCd: OrgCd }): "AX" | "HX" | null {
  if (actor.role === "AX_ADMIN") return "AX";
  if (actor.role === "HX_REVIEWER") return "HX";
  return null;
}
