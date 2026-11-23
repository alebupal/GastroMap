"use client";

import { useTheme } from "./ThemeProvider";
import { useT } from "@/lib/i18n/client";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useT();

  return (
    <div
      className={`relative grid grid-cols-2 items-center bg-slate-100 dark:bg-slate-800/90 rounded-full p-0.5 border border-slate-200/80 dark:border-slate-700/60 shadow-xs ${className}`}
      role="group"
      aria-label={t("theme.toggle_aria")}
    >
      {/* Píldora deslizante */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          theme === "dark"
            ? "translate-x-full bg-slate-900"
            : "translate-x-0 bg-white"
        }`}
      />
      <button
        type="button"
        onClick={() => {
          if (theme !== "light") toggleTheme();
        }}
        className={`relative z-10 group flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors duration-200 active:scale-95 cursor-pointer ${
          theme === "light"
            ? "text-slate-900"
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        title={t("theme.switch_to_light")}
      >
        <span
          key={theme === "light" ? "sun-on" : "sun-off"}
          className={`material-symbols-outlined text-sm leading-none transition-transform duration-300 ${
            theme === "light"
              ? "text-amber-500 gm-sun-spin"
              : "text-amber-500/80 group-hover:rotate-45"
          }`}
          style={theme === "light" ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          light_mode
        </span>
        <span className="hidden sm:inline text-[11px]">{t("theme.light")}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (theme !== "dark") toggleTheme();
        }}
        className={`relative z-10 group flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors duration-200 active:scale-95 cursor-pointer ${
          theme === "dark"
            ? "text-amber-400"
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
        title={t("theme.switch_to_dark")}
      >
        <span
          key={theme === "dark" ? "moon-on" : "moon-off"}
          className={`material-symbols-outlined text-sm leading-none transition-transform duration-300 ${
            theme === "dark"
              ? "text-amber-400 gm-moon-swing"
              : "group-hover:-rotate-12"
          }`}
          style={theme === "dark" ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          dark_mode
        </span>
        <span className="hidden sm:inline text-[11px]">{t("theme.dark")}</span>
      </button>
    </div>
  );
}
