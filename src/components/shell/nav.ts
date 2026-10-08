import { canAccessPath } from "@/lib/auth/permissions";
import type { Role } from "@/lib/types";
import type { IconName } from "../ui/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  ai?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "과제 선정",
    items: [
      { href: "/", label: "대시보드", icon: "dashboard" },
      { href: "/projects", label: "과제 포트폴리오", icon: "folder" },
      { href: "/selection", label: "선정 보드", icon: "board" },
      { href: "/report", label: "보고서", icon: "report" },
    ],
  },
  {
    label: "생산성 측정",
    items: [
      { href: "/measure", label: "측정 대시보드", icon: "gauge" },
      { href: "/today", label: "오늘 공수 입력", icon: "clock" },
      { href: "/defects", label: "결함 관리", icon: "bug" },
      { href: "/collect", label: "데이터 수집", icon: "upload" },
      { href: "/check", label: "데이터 점검", icon: "shield" },
    ],
  },
  {
    label: "관리",
    items: [
      { href: "/admin/criteria", label: "평가 기준", icon: "sliders" },
      { href: "/admin/codes", label: "코드·목표", icon: "tags" },
      { href: "/admin/measure", label: "측정 설정", icon: "ruler" },
      { href: "/admin/users", label: "계정", icon: "users" },
      { href: "/admin/history", label: "변경 이력", icon: "history" },
      { href: "/admin/ai", label: "AI 판정", icon: "spark", ai: true },
    ],
  },
];

export function visibleNav(role: Role, aiEnabled: boolean): NavGroup[] {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => canAccessPath(role, i.href) && (!i.ai || aiEnabled)),
  })).filter((g) => g.items.length > 0);
}

export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
