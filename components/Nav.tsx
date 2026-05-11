"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "./Logo";
import { Menu, X, ChevronDown } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";

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
    // The callback fires while GoTrueClient still holds its internal lock
    // (e.g. during signInWithPassword / signOut). Calling loadUser() — which
    // awaits supabase.auth.getUser() — directly would try to re-acquire the
    // same non-reentrant lock and deadlock the sign-in, leaving the login
    // button stuck on "登录中..." (and signup's 15s wrapper firing
    // "注册完成但登录超时"). Defer to the next microtask so the lock has been
    // released before we re-enter the auth client.
    // https://supabase.com/docs/reference/javascript/auth-onauthstatechange
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

  async function logout() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    // Hard navigation forces a fresh server render so every layout drops the
    // stale authenticated state and any in-flight RSC requests are cancelled.
    window.location.assign("/");
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 border-b border-border ${
        showSolid ? "bg-background" : "bg-transparent"
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
            <Link
              href="/listener"
              className="btn-primary text-[14px] py-1.5 px-3"
            >
              倾听者后台
            </Link>
          )}
          {user && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="btn-nav text-[14px] flex items-center gap-1"
              >
                {user.username}
                <motion.span
                  animate={{ rotate: dropdownOpen ? 180 : 0 }}
                  transition={{ duration: 0.2, ease: [0.215, 0.61, 0.355, 1] }}
                >
                  <ChevronDown size={14} />
                </motion.span>
              </button>
              <AnimatePresence>
                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: [0.215, 0.61, 0.355, 1] }}
                      className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-lg py-1 shadow-sm z-20 origin-top-right"
                    >
                      <Link
                        href={
                          user.is_listener
                            ? "/listener"
                            : user.listener_application_at
                            ? "/listener/pending"
                            : "/me"
                        }
                        onClick={() => setDropdownOpen(false)}
                        className="block px-3 py-2 text-[14px] hover:bg-accent-soft transition-colors"
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
                        className="block w-full text-left px-3 py-2 text-[14px] hover:bg-accent-soft transition-colors"
                      >
                        退出
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
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

      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.215, 0.61, 0.355, 1] }}
            className="md:hidden border-t border-border bg-background overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
