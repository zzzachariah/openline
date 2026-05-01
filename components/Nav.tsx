"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { Menu, X, ChevronDown } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    // The homepage scroll-snap container is also scrollable
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
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadUser());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const showSolid = !transparentOnTop || scrolled;

  async function logout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 ${
        showSolid ? "bg-background border-b border-border" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <Logo size={26} className="text-accent" />
          <span className="text-[15px] font-medium tracking-tight">openline</span>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          <Link href="/" className="btn-nav text-[14px]">介绍</Link>
          {!user && (
            <>
              <Link href="/book" className="btn-nav text-[14px]">预约</Link>
              <Link href="/login" className="btn-nav text-[14px]">登录</Link>
            </>
          )}
          {user && !user.is_listener && !user.listener_application_at && (
            <>
              <Link href="/book" className="btn-nav text-[14px]">预约</Link>
              <Link href="/me" className="btn-nav text-[14px]">我的</Link>
            </>
          )}
          {user && !user.is_listener && user.listener_application_at && (
            <Link href="/listener/pending" className="btn-nav text-[14px]">审核中</Link>
          )}
          {user && user.is_listener && (
            <Link href="/listener" className="btn-nav text-[14px]">后台</Link>
          )}
          {user && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="btn-nav text-[14px] flex items-center gap-1"
              >
                {user.username}
                <ChevronDown size={14} />
              </button>
              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-lg py-1 shadow-sm z-20">
                    <Link
                      href={
                        user.is_listener
                          ? "/listener"
                          : user.listener_application_at
                          ? "/listener/pending"
                          : "/me"
                      }
                      onClick={() => setDropdownOpen(false)}
                      className="block px-3 py-2 text-[14px] hover:bg-accent-soft"
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
                      className="block w-full text-left px-3 py-2 text-[14px] hover:bg-accent-soft"
                    >
                      退出
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="菜单"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-6 py-4 flex flex-col gap-2">
            <Link href="/" onClick={() => setMenuOpen(false)} className="py-2 text-[15px]">介绍</Link>
            {!user && (
              <>
                <Link href="/book" onClick={() => setMenuOpen(false)} className="py-2 text-[15px]">预约</Link>
                <Link href="/login" onClick={() => setMenuOpen(false)} className="py-2 text-[15px]">登录</Link>
              </>
            )}
            {user && !user.is_listener && !user.listener_application_at && (
              <>
                <Link href="/book" onClick={() => setMenuOpen(false)} className="py-2 text-[15px]">预约</Link>
                <Link href="/me" onClick={() => setMenuOpen(false)} className="py-2 text-[15px]">我的预约</Link>
              </>
            )}
            {user && !user.is_listener && user.listener_application_at && (
              <Link href="/listener/pending" onClick={() => setMenuOpen(false)} className="py-2 text-[15px]">申请审核中</Link>
            )}
            {user && user.is_listener && (
              <Link href="/listener" onClick={() => setMenuOpen(false)} className="py-2 text-[15px]">倾听者后台</Link>
            )}
            {user && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="py-2 text-[15px] text-left text-muted"
              >
                退出
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
