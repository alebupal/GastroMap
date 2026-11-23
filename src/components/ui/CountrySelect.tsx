"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { WORLD_COUNTRIES, type Country } from "@/data/worldCountries";
import { useT } from "@/lib/i18n/client";

interface CountrySelectProps {
  value: string;
  onChange: (countryName: string) => void;
  className?: string;
}

export function CountrySelect({ value, onChange, className = "" }: CountrySelectProps) {
  const { t, locale } = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Encontrar el país actual
  const currentCountry = useMemo(() => {
    return (
      WORLD_COUNTRIES.find(
        (c) =>
          c.name.toLowerCase() === (value || "").toLowerCase() ||
          c.nameEn.toLowerCase() === (value || "").toLowerCase()
      ) || {
        code: "XX",
        name: value || "España",
        nameEn: value || "Spain",
        flag: value === "España" ? "🇪🇸" : "🌍",
      }
    );
  }, [value]);

  // Filtrar países según búsqueda
  const filteredCountries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WORLD_COUNTRIES;
    return WORLD_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.code.toLowerCase() === q
    );
  }, [query]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Autoenfoque en el buscador al abrir
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const displayName = locale === "en" ? currentCountry.nameEn : currentCountry.name;

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Botón selector principal */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setQuery("");
        }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-0 focus:border-slate-400 dark:focus:border-slate-500 cursor-pointer shadow-xs transition"
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-base">{currentCountry.flag}</span>
          <span className="truncate">{displayName}</span>
        </span>
        <span className="text-slate-400 text-[10px] shrink-0">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* Menú desplegable con buscador */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 space-y-1.5 max-h-72 flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {/* Buscador */}
          <div className="relative shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("location.country_placeholder")}
              className="w-full px-2.5 py-1.5 pl-8 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-0 focus:border-slate-400 dark:focus:border-slate-500 transition"
            />
            <span className="material-symbols-outlined text-sm text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none leading-none">
              search
            </span>
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Lista de países */}
          <div className="overflow-y-auto space-y-0.5 pr-0.5 flex-1 max-h-56">
            {filteredCountries.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                {t("location.no_countries_found")}
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected =
                  c.name.toLowerCase() === currentCountry.name.toLowerCase();
                const countryTitle = locale === "en" ? c.nameEn : c.name;
                const countrySubtitle = locale === "en" ? c.name : c.nameEn;

                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      onChange(c.name);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                      isSelected
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base shrink-0">{c.flag}</span>
                      <span className="truncate">{countryTitle}</span>
                      {countrySubtitle !== countryTitle && (
                        <span className="text-[10px] text-slate-400 truncate">
                          ({countrySubtitle})
                        </span>
                      )}
                    </div>
                    {isSelected && <span className="text-amber-500 text-xs font-black">✓</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
