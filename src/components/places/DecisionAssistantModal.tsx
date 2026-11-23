"use client";

import { useState, useEffect, useMemo } from "react";
import { useT } from "@/lib/i18n/client";
import { OccasionIcon } from "@/components/ui/OccasionIcon";

interface DecisionAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  occasions: Array<{ id: string; name: string; icon: string; placesCount?: number }>;
  selectedOccasions: string[];
  onSelectOccasions: (occs: string[]) => void;
  tags?: Array<{ id: string; name: string; placesCount: number }>;
  selectedTags?: string[];
  onSelectTags?: (tags: string[]) => void;
  selectedPrice: string | null;
  onSelectPrice: (price: string | null) => void;
  experienceFilter: "all" | "visited_by_me" | "untried" | "favorite" | "pending";
  onSelectExperience: (exp: "all" | "visited_by_me" | "untried" | "favorite" | "pending") => void;
  nearMeActive: boolean;
  onToggleNearMe: () => void;
  radiusKm: number;
  onChangeRadius: (km: number) => void;
  countries?: Array<{ value: string; label: string }>;
  selectedCountry?: string;
  onSelectCountry?: (country: string) => void;
  cities?: string[];
  selectedCity?: string;
  onSelectCity?: (city: string) => void;
  matchingCount?: number;
  onReset: () => void;
}

export function DecisionAssistantModal({
  isOpen,
  onClose,
  occasions,
  selectedOccasions,
  onSelectOccasions,
  tags = [],
  selectedTags = [],
  onSelectTags,
  selectedPrice,
  onSelectPrice,
  experienceFilter,
  onSelectExperience,
  nearMeActive,
  onToggleNearMe,
  radiusKm,
  onChangeRadius,
  countries = [],
  selectedCountry = "all",
  onSelectCountry,
  cities = [],
  selectedCity = "all",
  onSelectCity,
  matchingCount,
  onReset,
}: DecisionAssistantModalProps) {
  const { t } = useT();
  const [tagQuery, setTagQuery] = useState("");
  const [showAllTags, setShowAllTags] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const visibleTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    const list = q ? tags.filter((tg) => tg.name.toLowerCase().includes(q)) : tags;
    return q || showAllTags ? list : list.slice(0, 14);
  }, [tags, tagQuery, showAllTags]);

  if (!isOpen) return null;

  function toggleOccasion(id: string) {
    if (selectedOccasions.includes(id)) {
      onSelectOccasions(selectedOccasions.filter((o) => o !== id));
    } else {
      onSelectOccasions([...selectedOccasions, id]);
    }
  }

  function toggleTag(id: string) {
    if (!onSelectTags) return;
    if (selectedTags.includes(id)) {
      onSelectTags(selectedTags.filter((tg) => tg !== id));
    } else {
      onSelectTags([...selectedTags, id]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Cabecera estilo DESIGN.md */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">tune</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100 tracking-tight">
                {t("assistant.title")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("assistant.subtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-lg leading-none">close</span>
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* 1. Planes / Categorías */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("assistant.step1_title")} ({occasions.length})
              </label>
              {selectedOccasions.length > 0 && (
                <button
                  type="button"
                  onClick={() => onSelectOccasions([])}
                  className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                >
                  Limpiar ({selectedOccasions.length})
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {occasions.map((occ) => {
                const active = selectedOccasions.includes(occ.id);
                return (
                  <button
                    key={occ.id}
                    type="button"
                    onClick={() => toggleOccasion(occ.id)}
                    className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-1.5 transition cursor-pointer ${
                      active
                        ? "bg-orange-600 border-orange-600 text-white shadow-xs"
                        : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-orange-300 dark:hover:border-orange-800"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <OccasionIcon icon={occ.icon} className="text-sm shrink-0" msClassName="text-[16px]" />
                      <span className="truncate">{occ.name}</span>
                    </span>
                    {typeof occ.placesCount === "number" && occ.placesCount > 0 && (
                      <span
                        className={`text-[10px] shrink-0 ${
                          active ? "text-white/80" : "text-slate-400"
                        }`}
                      >
                        {occ.placesCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Etiquetas / Especialidades */}
          {tags.length > 0 && onSelectTags && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("places.tags_title")} ({tags.length})
                </label>
                {selectedTags.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectTags([])}
                    className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                  >
                    Limpiar ({selectedTags.length})
                  </button>
                )}
              </div>

              {tags.length > 10 && (
                <div className="relative mb-2.5">
                  <span className="material-symbols-outlined text-sm text-slate-400 absolute left-3 top-2 pointer-events-none">
                    search
                  </span>
                  <input
                    type="text"
                    value={tagQuery}
                    onChange={(e) => setTagQuery(e.target.value)}
                    placeholder="Buscar etiqueta (#tapas, #pizza, #brasa...)"
                    className="w-full pl-8 pr-8 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  />
                  {tagQuery && (
                    <button
                      type="button"
                      onClick={() => setTagQuery("")}
                      className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {visibleTags.map((tg) => {
                  const active = selectedTags.includes(tg.id);
                  return (
                    <button
                      key={tg.id}
                      type="button"
                      onClick={() => toggleTag(tg.id)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
                        active
                          ? "bg-orange-600 border-orange-600 text-white shadow-xs"
                          : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-orange-300"
                      }`}
                    >
                      #{tg.name}
                      {tg.placesCount > 0 && (
                        <span className={`ml-1 text-[10px] ${active ? "text-white/80" : "text-slate-400"}`}>
                          ({tg.placesCount})
                        </span>
                      )}
                    </button>
                  );
                })}
                {!tagQuery.trim() && tags.length > 14 && (
                  <button
                    type="button"
                    onClick={() => setShowAllTags((prev) => !prev)}
                    className="px-3 py-1 rounded-full text-xs font-bold border border-dashed border-orange-400/70 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition cursor-pointer"
                  >
                    {showAllTags ? "Ver menos" : `+${tags.length - 14} más`}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 3. Rango de precio */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
              {t("assistant.step2_title")}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "€", label: "< 15 €" },
                { id: "€€", label: "15 - 30 €" },
                { id: "€€€", label: "30 - 50 €" },
                { id: "€€€€", label: "> 50 €" },
              ].map((p) => {
                const active = selectedPrice === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPrice(active ? null : p.id)}
                    className={`py-2 px-3 rounded-full text-xs font-bold border transition cursor-pointer ${
                      active
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-300"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 italic">
              {t("assistant.step2_hint")}
            </p>
          </div>

          {/* 4. Localización */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              {t("assistant.step3_title")}
            </label>

            {(countries.length > 0 || cities.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {countries.length > 0 && onSelectCountry && (
                  <label className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <span className="material-symbols-outlined text-base text-orange-600 leading-none shrink-0">
                      public
                    </span>
                    <select
                      value={selectedCountry}
                      onChange={(e) => onSelectCountry(e.target.value)}
                      aria-label={t("places.country_filter")}
                      className="w-full bg-transparent focus:outline-none cursor-pointer font-bold truncate"
                    >
                      <option value="all">{t("places.all_countries")}</option>
                      {countries.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {cities.length > 0 && onSelectCity && (
                  <label className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <span className="material-symbols-outlined text-base text-orange-600 leading-none shrink-0">
                      location_city
                    </span>
                    <select
                      value={selectedCity}
                      onChange={(e) => onSelectCity(e.target.value)}
                      aria-label={t("places.city_filter")}
                      className="w-full bg-transparent focus:outline-none cursor-pointer font-bold truncate"
                    >
                      <option value="all">{t("places.all_cities")}</option>
                      {cities.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleNearMe}
                className={`flex-1 py-2.5 px-4 rounded-full text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  nearMeActive
                    ? "bg-orange-600 border-orange-600 text-white shadow-xs"
                    : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-orange-300"
                }`}
              >
                <span className="material-symbols-outlined text-base leading-none">near_me</span>
                <span>{nearMeActive ? t("assistant.step3_active") : t("assistant.step3_inactive")}</span>
              </button>

              {nearMeActive && (
                <select
                  value={radiusKm}
                  onChange={(e) => onChangeRadius(Number(e.target.value))}
                  className="py-2.5 px-3.5 rounded-full text-xs font-bold bg-[#f2f3ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value={1}>1 km</option>
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={25}>25 km</option>
                </select>
              )}
            </div>
          </div>

          {/* 5. Experiencia */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
              {t("assistant.step4_title")}
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => onSelectExperience(experienceFilter === "untried" ? "all" : "untried")}
                className={`p-2.5 rounded-2xl border font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  experienceFilter === "untried"
                    ? "bg-orange-600 border-orange-600 text-white shadow-xs"
                    : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span>✨</span>
                <span>{t("assistant.untried")}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectExperience(experienceFilter === "visited_by_me" ? "all" : "visited_by_me")}
                className={`p-2.5 rounded-2xl border font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  experienceFilter === "visited_by_me"
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                    : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span>✅</span>
                <span>{t("assistant.visited_by_me")}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectExperience(experienceFilter === "favorite" ? "all" : "favorite")}
                className={`p-2.5 rounded-2xl border font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  experienceFilter === "favorite"
                    ? "bg-amber-500 border-amber-500 text-slate-950 shadow-xs"
                    : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span>⭐</span>
                <span>{t("assistant.favorites_only")}</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectExperience(experienceFilter === "pending" ? "all" : "pending")}
                className={`p-2.5 rounded-2xl border font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  experienceFilter === "pending"
                    ? "bg-amber-500 border-amber-500 text-slate-950 shadow-xs"
                    : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span>🕒</span>
                <span>{t("places.want_to_go")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pie del modal */}
        <div className="px-5 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 rounded-full bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            {t("assistant.reset")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-full text-xs font-extrabold bg-orange-600 hover:bg-orange-700 text-white transition cursor-pointer shadow-sm"
          >
            {t("assistant.view_results")}
            {typeof matchingCount === "number" ? ` (${matchingCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
