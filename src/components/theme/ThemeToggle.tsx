"use client";

import { useTheme } from "./ThemeProvider";
import { useT } from "@/lib/i18n/client";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useT();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`w-8 h-8 sm:w-auto p-1.5 sm:p-2 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
        theme === "dark"
          ? "bg-slate-900/80 border-slate-800 hover:border-slate-700 text-amber-400 hover:text-amber-300"
          : "bg-white border-slate-200 hover:border-slate-300 text-amber-600 hover:text-amber-700 shadow-xs"
      } ${className}`}
      title={theme === "dark" ? t("theme.switch_to_light") : t("theme.switch_to_dark")}
      aria-label={t("theme.toggle_aria")}
    >
      <span className="text-sm">{theme === "dark" ? "☀️" : "🌙"}</span>
      <span className="hidden sm:inline text-[11px] font-bold">
        {theme === "dark" ? t("theme.light") : t("theme.dark")}
      </span>
    </button>
  );
}
