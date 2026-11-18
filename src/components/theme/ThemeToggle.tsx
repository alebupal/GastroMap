"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
        theme === "dark"
          ? "bg-slate-900/80 border-slate-800 hover:border-slate-700 text-amber-400 hover:text-amber-300"
          : "bg-white border-slate-200 hover:border-slate-300 text-amber-600 hover:text-amber-700 shadow-xs"
      } ${className}`}
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label="Cambiar tema de color"
    >
      <span className="text-sm">{theme === "dark" ? "☀️" : "🌙"}</span>
      <span className="hidden sm:inline text-[11px] font-bold">
        {theme === "dark" ? "Claro" : "Oscuro"}
      </span>
    </button>
  );
}
