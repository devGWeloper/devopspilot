import { canAccessPath } from "@/lib/auth/permissions";
import type { Role } from "@/lib/types";
import type { IconName } from "../ui/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export const NAV: NavItem[] = [
  { href: "/", label: "PoC 과제 현황", icon: "folder" },
  { href: "/effort", label: "투입 공수", icon: "clock" },
  { href: "/dashboard", label: "측정 결과", icon: "gauge" },
  { href: "/admin", label: "시스템 관리", icon: "sliders" },
];

export function visibleNav(role: Role): NavItem[] {
  return NAV.filter((i) => canAccessPath(role, i.href));
}

export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
