import { canAccessPath } from "@/lib/auth/permissions";
import type { Role } from "@/lib/types";
import type { IconName } from "../ui/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "PoC",
    items: [
      { href: "/", label: "과제 현황", icon: "folder" },
      { href: "/effort", label: "공수 입력", icon: "clock" },
      { href: "/dashboard", label: "측정 결과", icon: "gauge" },
    ],
  },
  { label: "관리", items: [{ href: "/admin", label: "시스템 관리", icon: "sliders" }] },
];

export function visibleNav(role: Role): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => canAccessPath(role, i.href)) })).filter((g) => g.items.length > 0);
}

export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
