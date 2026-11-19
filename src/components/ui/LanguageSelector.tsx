"use client";

import { useT } from "@/lib/i18n/client";
import { LOCALES, type Locale } from "@/lib/i18n/config";

const DEFAULT_NAMES: Array<{ code: Locale; name: string }> = [
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
];

export function LanguageSelector({
  names = DEFAULT_NAMES,
  className = "",
}: {
  names?: Array<{ code: Locale; name: string }>;
  className?: string;
} = {}) {
  const { locale, setLocale, t } = useT();
  const options = names && names.length ? names : LOCALES.map((c) => ({ code: c, name: c.toUpperCase() }));

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="pointer-events-none absolute left-2 text-xs">🌐</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("common.language")}
        className="appearance-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 pl-6 pr-5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-xs"
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1.5 text-[8px] text-slate-400">▼</span>
    </label>
  );
}
