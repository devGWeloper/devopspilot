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
      { href: "/selection", label: "과제 선정 현황", icon: "layers" },
      { href: "/", label: "과제 현황", icon: "folder" },
      { href: "/effort", label: "공수 입력", icon: "clock" },
      { href: "/dashboard", label: "측정 결과", icon: "gauge" },
    ],
  },
  {
    label: "관리",
    items: [
      { href: "/master", label: "기준 데이터", icon: "tags" },
      { href: "/monitor", label: "공수 모니터링", icon: "shield" },

      { href: "/admin", label: "시스템 관리", icon: "sliders" },
    ],
  },
  { label: "도움말", items: [{ href: "/guide", label: "작성 가이드", icon: "info" }] },
];

export function visibleNav(role: Role): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => canAccessPath(role, i.href)) })).filter((g) => g.items.length > 0);
}

export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
