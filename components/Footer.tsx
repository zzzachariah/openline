"use client";

import Link from "next/link";
import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";

export default function Footer() {
  const { theme, toggle } = useTheme();
  return (
    <footer className="w-full border-t border-border mt-24">
      <div className="max-w-6xl mx-auto px-6 py-10 flex items-center justify-between gap-4 text-caption text-muted">
        <span>© 2026 OpenLine</span>
        <div className="flex items-center gap-5">
          <Link
            href="/listener/signup"
            className="hover:text-foreground transition-colors"
          >
            成为倾听者
          </Link>
          <button
            onClick={toggle}
            aria-label="切换主题"
            className="p-2 rounded-full hover:bg-accent-soft transition-colors"
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </div>
    </footer>
  );
}
