"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarPlus, User, LayoutGrid } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";

type NavUser = {
  username: string;
  is_listener: boolean;
  listener_application_at: string | null;
} | null;

const HIDDEN_PATTERNS = [/^\/chat\//, /^\/listener\/chat\//];

export default function MobileTabBar() {
  const pathname = usePathname();
  const [user, setUser] = useState<NavUser>(null);

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
      if (active) setUser((profile as NavUser) ?? null);
    }

    loadUser();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadUser());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const hidden = HIDDEN_PATTERNS.some((p) => p.test(pathname || ""));
  // Homepage uses its own 100vh snap-container; adding body padding-bottom
  // there would create a second scrollable area, so we let the tab bar
  // overlay the bottom of the snap surface without reserving space.
  const reserveSpace = !hidden && pathname !== "/";

  useEffect(() => {
    if (reserveSpace) {
      document.body.classList.add("has-mobile-tabbar");
      return () => document.body.classList.remove("has-mobile-tabbar");
    }
    document.body.classList.remove("has-mobile-tabbar");
  }, [reserveSpace]);

  if (hidden) return null;

  const tabs = buildTabs(user);

  return (
    <nav
      aria-label="底部导航"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border pb-safe"
    >
      <ul className="flex items-stretch justify-around">
        {tabs.map((t) => {
          const active = isActive(pathname || "", t.matchPatterns);
          const Icon = t.icon;
          return (
            <li key={t.label} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2 : 1.75} />
                <span className="text-[11px] leading-none">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type Tab = {
  label: string;
  href: string;
  icon: typeof Home;
  matchPatterns: RegExp[];
};

function buildTabs(user: NavUser): Tab[] {
  if (user?.is_listener) {
    return [
      { label: "首页", href: "/", icon: Home, matchPatterns: [/^\/$/] },
      {
        label: "后台",
        href: "/listener",
        icon: LayoutGrid,
        matchPatterns: [/^\/listener(\/|$)/],
      },
    ];
  }
  if (user && user.listener_application_at) {
    return [
      { label: "首页", href: "/", icon: Home, matchPatterns: [/^\/$/] },
      {
        label: "预约",
        href: "/book",
        icon: CalendarPlus,
        matchPatterns: [/^\/book/],
      },
      {
        label: "我",
        href: "/listener/pending",
        icon: User,
        matchPatterns: [/^\/listener\/pending/, /^\/me/],
      },
    ];
  }
  if (user) {
    return [
      { label: "首页", href: "/", icon: Home, matchPatterns: [/^\/$/] },
      {
        label: "预约",
        href: "/book",
        icon: CalendarPlus,
        matchPatterns: [/^\/book/],
      },
      { label: "我", href: "/me", icon: User, matchPatterns: [/^\/me/] },
    ];
  }
  return [
    { label: "首页", href: "/", icon: Home, matchPatterns: [/^\/$/] },
    {
      label: "预约",
      href: "/book",
      icon: CalendarPlus,
      matchPatterns: [/^\/book/],
    },
    {
      label: "登录",
      href: "/login",
      icon: User,
      matchPatterns: [/^\/login/, /^\/signup/],
    },
  ];
}

function isActive(pathname: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(pathname));
}
