import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        muted: "var(--muted)",
        border: "var(--border)",
        surface: "var(--surface)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-noto-sc)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["56px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-mobile": ["36px", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        h1: ["40px", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        "h1-mobile": ["28px", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
        h2: ["28px", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        "h2-mobile": ["22px", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        "body-lg": ["19px", { lineHeight: "1.65" }],
        body: ["16px", { lineHeight: "1.7" }],
        caption: ["14px", { lineHeight: "1.5" }],
      },
      maxWidth: {
        prose: "640px",
      },
      transitionTimingFunction: {
        "out-cubic": "cubic-bezier(0.215, 0.61, 0.355, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
