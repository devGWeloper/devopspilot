"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { api, onSessionExpired } from "@/lib/apiClient";
import { ORG_LABEL } from "@/lib/labels";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { isActive, visibleNav } from "./nav";
import s from "./shell.module.css";

const COLLAPSE_KEY = "poc.sidebar.collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const { me, storeKind } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expired, setExpired] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // 저장소 접근이 막힌 브라우저에서도 기본 펼침으로 동작
    }
    return onSessionExpired(() => setExpired(true));
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      // 무시
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  const groups = visibleNav(me.role);

  return (
    <div className={`${s.shell} ${collapsed ? s.collapsed : ""}`}>
      {mobileOpen && <div className={s.overlay} onClick={() => setMobileOpen(false)} />}
      <aside className={`${s.sidebar} ${mobileOpen ? s.sidebarOpen : ""}`}>
        <Link href="/" className={s.brand}>
          <span className={s.brandMark}>PoC</span>
          <span className={s.brandText}>
            <span className={s.brandTitle}>AI 생산성 PoC</span>
            <span className={s.brandSub}>SK hynix × SK AX</span>
          </span>
        </Link>
        <nav className={s.nav}>
          {groups.map((g) => (
            <div key={g.label} className={s.group}>
              <div className={s.groupLabel}>{g.label}</div>
              {g.items.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  className={`${s.item} ${isActive(i.href, pathname) ? s.itemActive : ""}`}
                  title={collapsed ? i.label : undefined}
                >
                  <Icon name={i.icon} size={17} />
                  <span className={s.itemLabel}>{i.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <button className={s.collapseBtn} onClick={toggleCollapse} aria-label="사이드바 접기">
          <Icon name="panel" size={17} />
          <span className={s.collapseLabel}>메뉴 접기</span>
        </button>
      </aside>

      <div className={s.main}>
        <header className={s.topbar}>
          <div className={s.topLeft}>
            <button className={s.mobileMenu} onClick={() => setMobileOpen(true)} aria-label="메뉴 열기">
              <Icon name="menu" size={20} />
            </button>
            {storeKind === "json" && (
              <span className={`${s.critChip} ${s.demoChip}`} title="config.yml 에 DB 가 설정되지 않아 로컬 파일에 저장 중입니다">
                로컬 데모 데이터
              </span>
            )}
          </div>
          <div className={s.topRight} ref={menuRef} style={{ position: "relative" }}>
            {(
              <button className={s.userBtn} onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
                <span className={`${s.avatar} ${me.orgCd === "SKHYNIX" ? s.avatarHx : ""}`}>{me.userNm.slice(0, 1)}</span>
                <span className={s.userText}>
                  <span className={s.userName}>{me.userNm}</span>
                  <span className={s.userRole}>
                    {ORG_LABEL[me.orgCd]} · {ROLE_LABEL[me.role]}
                  </span>
                </span>
                <Icon name="chevronDown" size={14} />
              </button>
            )}
            {menuOpen && (
              <div className={s.menu} role="menu">
                <button className={s.menuItem} onClick={() => (setMenuOpen(false), router.push("/me"))}>
                  <Icon name="user" /> 내 정보
                </button>
                <button className={s.menuItem} onClick={logout}>
                  <Icon name="logout" /> 로그아웃
                </button>
              </div>
            )}
          </div>
        </header>
        <main className={s.content}>{children}</main>
      </div>

      <Modal
        open={expired}
        title="세션이 만료되었습니다"
        onClose={() => undefined}
        footer={
          <Button variant="primary" onClick={() => router.replace(`/login?next=${encodeURIComponent(pathname)}`)}>
            다시 로그인
          </Button>
        }
      >
        <p className="muted">보안을 위해 일정 시간이 지나면 로그아웃됩니다. 다시 로그인하면 보던 화면으로 돌아옵니다.</p>
      </Modal>
    </div>
  );
}
