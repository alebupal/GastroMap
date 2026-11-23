"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useT } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/lib/i18n/config";

const DEFAULT_NAMES: Array<{ code: Locale; name: string; flag: string }> = [
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "en", name: "English", flag: "🇬🇧" },
];

export function LanguageSelector({
  names,
  className = "",
  value,
  onChange,
  fullWidth = false,
  name,
}: {
  names?: Array<{ code: Locale; name: string }>;
  className?: string;
  value?: Locale;
  onChange?: (next: Locale) => void;
  fullWidth?: boolean;
  name?: string;
} = {}) {
  const { locale: ctxLocale, setLocale: ctxSetLocale, t } = useT();
  const activeLocale = value ?? ctxLocale;
  const handleSelect = onChange ?? ctxSetLocale;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => {
    if (names && names.length) {
      return names.map((o) => {
        const base = DEFAULT_NAMES.find((d) => d.code === o.code);
        return {
          code: o.code,
          name: o.name,
          flag: base?.flag || "🌐",
        };
      });
    }
    return LOCALES.map((c) => {
      const base = DEFAULT_NAMES.find((d) => d.code === c);
      return base || { code: c, name: c.toUpperCase(), flag: "🌐" };
    });
  }, [names]);

  const current = options.find((o) => o.code === activeLocale) || options[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`relative ${fullWidth ? "block w-full" : "inline-block"} ${className}`}
    >
      {name && <input type="hidden" name={name} value={activeLocale} />}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setQuery("");
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t("common.language")}
        className={
          fullWidth
            ? "w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/60 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-xs transition cursor-pointer"
        }
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="leading-none">{current?.flag}</span>
          <span className="truncate">{current?.name}</span>
        </span>
        <span
          className={`material-symbols-outlined text-sm text-slate-400 leading-none transition-transform duration-150 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={t("common.language")}
          className={`absolute ${
            fullWidth ? "left-0 right-0" : "right-0 min-w-[164px]"
          } top-full mt-2 max-h-64 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl dark:shadow-2xl z-[1200] p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150`}
        >
          {options.length > 6 && (
            <div className="p-1 pb-1.5">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.language") + "..."}
                autoFocus
                className="w-full px-2.5 py-1.5 rounded-xl bg-[#f8f9ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          )}

          {filtered.map((o) => {
            const active = o.code === activeLocale;
            return (
              <button
                key={o.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setIsOpen(false);
                  if (!active) handleSelect(o.code);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition cursor-pointer text-left ${
                  active
                    ? "bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 font-extrabold"
                    : "text-slate-700 dark:text-slate-200 hover:bg-[#f2f3ff] dark:hover:bg-slate-800 font-semibold"
                }`}
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <span className="leading-none">{o.flag}</span>
                  <span className="truncate">{o.name}</span>
                </span>
                {active && (
                  <span className="material-symbols-outlined text-sm text-orange-600 dark:text-orange-400 leading-none shrink-0">
                    check
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
