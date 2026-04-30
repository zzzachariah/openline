"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";

export default function Footer() {
  const { theme, toggle } = useTheme();
  return (
    <footer className="w-full border-t border-border mt-24">
      <div className="max-w-6xl mx-auto px-6 py-10 flex items-center justify-between text-caption text-muted">
        <span>© 2026 OpenLine</span>
        <button
          onClick={toggle}
          aria-label="切换主题"
          className="p-2 rounded-full hover:bg-accent-soft transition-colors"
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </footer>
  );
}
