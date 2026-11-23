"use client";

import { useT } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/lib/i18n/config";

const DEFAULT_NAMES: Array<{ code: Locale; name: string; flag: string; short: string }> = [
  { code: "es", name: "Español", flag: "🇪🇸", short: "ES" },
  { code: "en", name: "English", flag: "🇬🇧", short: "EN" },
];

export function LanguageSelector({
  names,
  className = "",
}: {
  names?: Array<{ code: Locale; name: string }>;
  className?: string;
} = {}) {
  const { locale, setLocale, t } = useT();

  const options =
    names && names.length
      ? names.map((o) => {
          const base = DEFAULT_NAMES.find((d) => d.code === o.code);
          return {
            code: o.code,
            name: o.name,
            flag: base?.flag || "🌐",
            short: o.code.toUpperCase(),
          };
        })
      : LOCALES.map((c) => {
          const base = DEFAULT_NAMES.find((d) => d.code === c);
          return (
            base || {
              code: c,
              name: c.toUpperCase(),
              flag: "🌐",
              short: c.toUpperCase(),
            }
          );
        });

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={`inline-flex items-center bg-[#f2f3ff] dark:bg-slate-800/90 rounded-full p-0.5 border border-slate-200/80 dark:border-slate-700/60 shadow-xs ${className}`}
    >
      {options.map((o) => {
        const active = locale === o.code;
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => {
              if (!active) setLocale(o.code);
            }}
            aria-pressed={active}
            title={o.name}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
              active
                ? "bg-orange-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <span className="leading-none">{o.flag}</span>
            <span>{o.short}</span>
          </button>
        );
      })}
    </div>
  );
}
