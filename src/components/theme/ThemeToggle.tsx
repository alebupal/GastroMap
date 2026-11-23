"use client";

import { useTheme } from "./ThemeProvider";
import { useT } from "@/lib/i18n/client";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useT();

  return (
    <div
      className={`inline-flex items-center bg-slate-100 dark:bg-slate-800/90 rounded-full p-0.5 border border-slate-200 dark:border-slate-700/60 ${className}`}
      role="group"
      aria-label={t("theme.toggle_aria")}
    >
      <button
        type="button"
        onClick={() => {
          if (theme !== "light") toggleTheme();
        }}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
          theme === "light"
            ? "bg-white text-slate-900 shadow-xs"
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        title={t("theme.switch_to_light")}
      >
        <span>☀️</span>
        <span className="hidden sm:inline text-[11px]">{t("theme.light")}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (theme !== "dark") toggleTheme();
        }}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
          theme === "dark"
            ? "bg-slate-900 text-amber-400 shadow-xs"
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        title={t("theme.switch_to_dark")}
      >
        <span>🌙</span>
        <span className="hidden sm:inline text-[11px]">{t("theme.dark")}</span>
      </button>
    </div>
  );
}
