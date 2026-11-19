"use client";

import { useT } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/lib/i18n/config";

const DEFAULT_NAMES: Array<{ code: Locale; name: string }> = [
  { code: "es", name: "🇪🇸 Español" },
  { code: "en", name: "🇬🇧 English" },
];

export function LanguageSelector({
  names = DEFAULT_NAMES,
  className = "",
}: {
  names?: Array<{ code: Locale; name: string }>;
  className?: string;
} = {}) {
  const { locale, setLocale, t } = useT();
  const options =
    names && names.length
      ? names
      : LOCALES.map((c) => ({
          code: c,
          name: c === "es" ? "🇪🇸 Español" : "🇬🇧 English",
        }));

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("common.language")}
        className="appearance-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 pl-2.5 pr-6 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-0 focus:border-slate-400 dark:focus:border-slate-600 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition"
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 text-[9px] text-slate-400">▼</span>
    </label>
  );
}
