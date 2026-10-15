"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { api, onSessionExpired } from "@/lib/apiClient";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { isActive, visibleNav } from "./nav";
import s from "./shell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const { me, storeKind } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [expired, setExpired] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => onSessionExpired(() => setExpired(true)), []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  return (
    <div className={s.shell}>
      <header className={s.bar}>
        <div className={s.barIn}>
          <Link href="/" className={s.brand}>
            <span className={s.brandTitle}>AI 활용 생산성 향상 PoC</span>
            <span className={s.brandSub}>SK hynix × SK AX</span>
          </Link>
          <nav className={s.tabs}>
            {visibleNav(me.role).map((i) => (
              <Link key={i.href} href={i.href} className={`${s.tab} ${isActive(i.href, pathname) ? s.tabActive : ""}`}>
                <Icon name={i.icon} size={15} />
                {i.label}
              </Link>
            ))}
          </nav>
          <div className={s.right} ref={menuRef}>
            {storeKind === "json" && (
              <span className={s.demoChip} title="config.yml 에 DB 가 설정되지 않아 로컬 파일에 저장 중입니다">
                로컬 데모
              </span>
            )}
            <button className={s.userBtn} onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
              <span className={s.avatar}>{me.userNm.slice(0, 1)}</span>
              <span className={s.userText}>
                <span className={s.userName}>{me.userNm}</span>
                <span className={s.userRole}>{ROLE_LABEL[me.role]}</span>
              </span>
              <Icon name="chevronDown" size={14} />
            </button>
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
        </div>
      </header>
      <main className={s.content}>{children}</main>

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
