"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import { Menu, X, ChevronDown, Sun, Moon } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useTheme } from "./ThemeProvider";

type NavUser = {
  username: string;
  is_listener: boolean;
  listener_application_at: string | null;
} | null;

type NavProps = {
  transparentOnTop?: boolean;
};

export default function Nav({ transparentOnTop = false }: NavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<NavUser>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const snap = document.querySelector(".snap-container");
    if (snap) {
      const onSnap = () => setScrolled((snap as HTMLElement).scrollTop > 80);
      snap.addEventListener("scroll", onSnap as EventListener, { passive: true } as AddEventListenerOptions);
      return () => {
        window.removeEventListener("scroll", onScroll);
        snap.removeEventListener("scroll", onSnap as EventListener);
      };
    }
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient();
    let active = true;

    async function loadUser() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (active) setUser(null);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, is_listener, listener_application_at")
        .eq("id", auth.user.id)
        .single();
      if (active && profile) setUser(profile as NavUser);
    }

    loadUser();
    // The callback fires while GoTrueClient still holds its internal lock
    // (e.g. during signInWithPassword / signOut). Awaiting getUser() inside it
    // would re-enter the same non-reentrant lock and deadlock sign-in. Defer
    // to the next microtask so the lock has been released before we re-enter.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        if (active) loadUser();
      }, 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const showSolid = !transparentOnTop || scrolled;
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : !!pathname?.startsWith(href);

  async function logout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    // Hard navigation forces a fresh server render so every layout drops the
    // stale authenticated state and any in-flight RSC requests are cancelled.
    window.location.assign("/");
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        showSolid ? "nav-solid" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/" className="nav-logo">
          <span className="nav-logo-mark text-accent">
            <Logo size={26} />
          </span>
          <span className="text-[15px] font-medium tracking-tight">openline</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          <Link href="/" className="nav-link" data-active={isActive("/")}>
            介绍
          </Link>
          {!user && (
            <>
              <Link href="/book" className="nav-link" data-active={isActive("/book")}>
                预约
              </Link>
              <Link href="/login" className="nav-link" data-active={isActive("/login")}>
                登录
              </Link>
            </>
          )}
          {user && !user.is_listener && !user.listener_application_at && (
            <>
              <Link href="/book" className="nav-link" data-active={isActive("/book")}>
                预约
              </Link>
              <Link href="/me" className="nav-link" data-active={isActive("/me")}>
                我的
              </Link>
            </>
          )}
          {user && !user.is_listener && user.listener_application_at && (
            <Link
              href="/listener/pending"
              className="nav-link"
              data-active={isActive("/listener/pending")}
            >
              审核中
            </Link>
          )}
          {user && user.is_listener && (
            <Link
              href="/listener"
              className="nav-link"
              data-active={isActive("/listener")}
            >
              后台
            </Link>
          )}
          {user && (
            <div className="relative ml-1">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="nav-link"
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
              >
                {user.username}
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="nav-dropdown absolute right-0 top-full mt-2 w-44 bg-surface border border-border rounded-lg py-1 shadow-md z-20 overflow-hidden">
                    <Link
                      href={
                        user.is_listener
                          ? "/listener"
                          : user.listener_application_at
                          ? "/listener/pending"
                          : "/me"
                      }
                      onClick={() => setDropdownOpen(false)}
                      className="nav-dropdown-item"
                    >
                      {user.is_listener
                        ? "倾听者后台"
                        : user.listener_application_at
                        ? "申请审核中"
                        : "我的预约"}
                    </Link>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        logout();
                      }}
                      className="nav-dropdown-item"
                    >
                      退出
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={toggle}
            aria-label="切换主题"
            className="nav-icon-btn ml-1"
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>

        <div className="md:hidden flex items-center gap-1">
          <button
            onClick={toggle}
            aria-label="切换主题"
            className="nav-icon-btn"
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button
            className="nav-icon-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="菜单"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 top-14 z-10 bg-background/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="md:hidden relative z-20 border-t border-border bg-background nav-dropdown shadow-sm">
            <div className="px-4 py-3 flex flex-col gap-1">
              {user && (
                <div className="px-3 pb-3 mb-1 border-b border-border">
                  <div className="text-caption text-muted">已登录</div>
                  <div className="text-[15px] font-medium tracking-tight truncate">
                    {user.username}
                  </div>
                </div>
              )}
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="nav-dropdown-item rounded-md"
                data-active={isActive("/")}
              >
                介绍
              </Link>
              {!user && (
                <>
                  <Link
                    href="/book"
                    onClick={() => setMenuOpen(false)}
                    className="nav-dropdown-item rounded-md"
                  >
                    预约
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="nav-dropdown-item rounded-md"
                  >
                    登录
                  </Link>
                  <Link
                    href="/listener/signup"
                    onClick={() => setMenuOpen(false)}
                    className="nav-dropdown-item rounded-md"
                  >
                    申请成为倾听者
                  </Link>
                </>
              )}
              {user && !user.is_listener && !user.listener_application_at && (
                <>
                  <Link
                    href="/book"
                    onClick={() => setMenuOpen(false)}
                    className="nav-dropdown-item rounded-md"
                  >
                    预约
                  </Link>
                  <Link
                    href="/me"
                    onClick={() => setMenuOpen(false)}
                    className="nav-dropdown-item rounded-md"
                  >
                    我的预约
                  </Link>
                </>
              )}
              {user && !user.is_listener && user.listener_application_at && (
                <Link
                  href="/listener/pending"
                  onClick={() => setMenuOpen(false)}
                  className="nav-dropdown-item rounded-md"
                >
                  申请审核中
                </Link>
              )}
              {user && user.is_listener && (
                <Link
                  href="/listener"
                  onClick={() => setMenuOpen(false)}
                  className="nav-dropdown-item rounded-md"
                >
                  倾听者后台
                </Link>
              )}
              {user && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="nav-dropdown-item rounded-md text-muted"
                >
                  退出
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
