"use client";

import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { useT } from "@/lib/i18n/client";
import type { PlaceWithDetails } from "@/lib/actions/places";

interface MobileFilterBarProps {
  textSearch: string;
  onTextSearchChange: (value: string) => void;
  showExtraFilters: boolean;
  onToggleExtraFilters: () => void;
  activeFiltersCount: number;
  activeMobileView: "list" | "map";
  onToggleMobileView: () => void;
  initialPlaces: PlaceWithDetails[];
  filteredPlacesCount: number;
  experienceFilter: "all" | "visited_by_me" | "untried" | "favorite" | "pending";
  onSelectExperience: (
    exp: "all" | "visited_by_me" | "untried" | "favorite" | "pending"
  ) => void;
  sortedOccasions: Array<{ id: string; name: string; icon: string; placesCount?: number }>;
  selectedOccasions: string[];
  onToggleOccasion: (occId: string) => void;
  onClearOccasions: () => void;
  userLocation: { latitude: number; longitude: number } | null;
  isLocating: boolean;
  onToggleLocation: () => void;
  onOpenRandom: () => void;
  onOpenAssistant: () => void;
  onResetFilters: () => void;
}

export function MobileFilterBar({
  textSearch,
  onTextSearchChange,
  showExtraFilters,
  onToggleExtraFilters,
  activeFiltersCount,
  activeMobileView,
  onToggleMobileView,
  initialPlaces,
  filteredPlacesCount,
  experienceFilter,
  onSelectExperience,
  sortedOccasions,
  selectedOccasions,
  onToggleOccasion,
  onClearOccasions,
  userLocation,
  isLocating,
  onToggleLocation,
  onOpenRandom,
  onOpenAssistant,
  onResetFilters,
}: MobileFilterBarProps) {
  const { t } = useT();

  return (
    <section className="lg:hidden space-y-2.5">
      {/* Fila 1: Buscador píldora con icono filtros + Botón naranja Lista/Mapa */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-full px-3.5 py-2 shadow-xs focus-within:ring-2 focus-within:ring-orange-500/40 transition">
          <span className="material-symbols-outlined text-orange-600 text-[18px] mr-2 shrink-0 leading-none">
            search
          </span>
          <input
            type="text"
            value={textSearch}
            onChange={(e) => onTextSearchChange(e.target.value)}
            placeholder={t("mobile_nav.search_placeholder")}
            className="w-full min-w-0 bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {textSearch && (
            <button
              type="button"
              onClick={() => onTextSearchChange("")}
              className="p-0.5 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
              aria-label={t("places.clear_filter")}
            >
              <span className="material-symbols-outlined text-sm leading-none">close</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleExtraFilters}
            aria-expanded={showExtraFilters}
            aria-label={t("places.more_filters")}
            className={`ml-1.5 relative p-1 rounded-full transition cursor-pointer shrink-0 ${
              showExtraFilters || activeFiltersCount > 0
                ? "text-orange-600 bg-orange-50 dark:bg-orange-950/50"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            <span className="material-symbols-outlined text-[18px] leading-none block">tune</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-orange-600 text-white text-[9px] font-black flex items-center justify-center leading-none">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleMobileView}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold shadow-sm shadow-orange-600/25 active:scale-95 transition shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[17px] leading-none">
            {activeMobileView === "map" ? "format_list_bulleted" : "map"}
          </span>
          <span>
            {activeMobileView === "map" ? t("places.view_list") : t("places.view_map")}
          </span>
        </button>
      </div>

      {/* Fila 2: Carrusel horizontal de píldoras rápidas */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 -mx-1 px-1">
        <button
          type="button"
          onClick={() => {
            onSelectExperience("all");
            onClearOccasions();
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition shrink-0 cursor-pointer ${
            experienceFilter === "all" && selectedOccasions.length === 0
              ? "bg-orange-600 text-white shadow-xs"
              : "bg-[#f2f3ff] dark:bg-slate-800/80 text-slate-700 dark:text-slate-200"
          }`}
        >
          <span>{t("places.all")}</span>
          <span className="text-[11px] opacity-80 font-extrabold">
            {initialPlaces.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            onSelectExperience(experienceFilter === "untried" ? "all" : "untried")
          }
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition shrink-0 cursor-pointer ${
            experienceFilter === "untried"
              ? "bg-orange-600 text-white shadow-xs"
              : "bg-[#f2f3ff] dark:bg-slate-800/80 text-slate-700 dark:text-slate-200"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              experienceFilter === "untried" ? "bg-white" : "bg-orange-600"
            }`}
          />
          <span>{t("places.unexplored")}</span>
          <span className="text-[11px] opacity-75 font-extrabold">
            {
              initialPlaces.filter(
                (p) => p.personalStatus !== "visited" && (!p.rating || p.rating === 0)
              ).length
            }
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            onSelectExperience(experienceFilter === "favorite" ? "all" : "favorite")
          }
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition shrink-0 cursor-pointer ${
            experienceFilter === "favorite"
              ? "bg-orange-600 text-white shadow-xs"
              : "bg-[#f2f3ff] dark:bg-slate-800/80 text-slate-700 dark:text-slate-200"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[14px] leading-none ${
              experienceFilter === "favorite" ? "text-white" : "text-amber-500"
            }`}
          >
            star
          </span>
          <span>{t("places.favorites")}</span>
          <span className="text-[11px] opacity-75 font-extrabold">
            {initialPlaces.filter((p) => p.isFavorite).length}
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            onSelectExperience(experienceFilter === "pending" ? "all" : "pending")
          }
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition shrink-0 cursor-pointer ${
            experienceFilter === "pending"
              ? "bg-orange-600 text-white shadow-xs"
              : "bg-[#f2f3ff] dark:bg-slate-800/80 text-slate-700 dark:text-slate-200"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[14px] leading-none ${
              experienceFilter === "pending" ? "text-white" : "text-orange-600 dark:text-orange-400"
            }`}
          >
            schedule
          </span>
          <span>{t("places.want_to_go")}</span>
          <span className="text-[11px] opacity-75 font-extrabold">
            {initialPlaces.filter((p) => p.personalStatus === "pending").length}
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            onSelectExperience(
              experienceFilter === "visited_by_me" ? "all" : "visited_by_me"
            )
          }
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition shrink-0 cursor-pointer ${
            experienceFilter === "visited_by_me"
              ? "bg-orange-600 text-white shadow-xs"
              : "bg-[#f2f3ff] dark:bg-slate-800/80 text-slate-700 dark:text-slate-200"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[14px] leading-none ${
              experienceFilter === "visited_by_me"
                ? "text-white"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            check_circle
          </span>
          <span>{t("places.visited")}</span>
          <span className="text-[11px] opacity-75 font-extrabold">
            {
              initialPlaces.filter(
                (p) =>
                  p.personalStatus === "visited" ||
                  (p.rating !== null && (p.rating ?? 0) > 0)
              ).length
            }
          </span>
        </button>

        {sortedOccasions.slice(0, 6).map((occ) => {
          const active = selectedOccasions.includes(occ.id);
          return (
            <button
              key={occ.id}
              type="button"
              onClick={() => onToggleOccasion(occ.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition shrink-0 cursor-pointer ${
                active
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-[#f2f3ff] dark:bg-slate-800/80 text-slate-700 dark:text-slate-200"
              }`}
            >
              <OccasionIcon icon={occ.icon} msClassName="text-[14px]" />
              <span>{occ.name}</span>
              {(occ.placesCount || 0) > 0 && (
                <span className="text-[11px] opacity-75 font-extrabold">
                  {occ.placesCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Fila 3: Tira compacta de accesos estrella (Filtros destacado, Cerca de mí y Al azar) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 -mx-1 px-1">
        <button
          type="button"
          onClick={onToggleExtraFilters}
          aria-expanded={showExtraFilters}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold whitespace-nowrap transition active:scale-95 shrink-0 cursor-pointer border ${
            showExtraFilters || activeFiltersCount > 0
              ? "bg-orange-600 border-orange-600 text-white shadow-sm shadow-orange-600/25"
              : "bg-orange-50 dark:bg-orange-950/50 border-orange-200/90 dark:border-orange-800/70 text-orange-700 dark:text-orange-300"
          }`}
        >
          <span className="material-symbols-outlined text-[15px] leading-none">tune</span>
          <span>{t("places.more_filters").replace(/^\+\s*/, "")}</span>
          {activeFiltersCount > 0 && (
            <span
              key={activeFiltersCount}
              className="min-w-[16px] h-[16px] px-1 rounded-full bg-white text-orange-700 text-[10px] font-black inline-flex items-center justify-center leading-none gm-pop"
            >
              {activeFiltersCount}
            </span>
          )}
        </button>

        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={onResetFilters}
            title={t("places.reset_filters")}
            aria-label={t("places.reset_filters")}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition active:scale-95 shrink-0 cursor-pointer bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 gm-popover-in"
          >
            <span className="material-symbols-outlined text-[15px] leading-none">filter_alt_off</span>
            <span>{t("places.clear_filter")}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleLocation}
          disabled={isLocating}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition active:scale-95 shrink-0 cursor-pointer border ${
            userLocation
              ? "bg-blue-600 border-blue-600 text-white shadow-xs"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-orange-600 dark:text-orange-400"
          }`}
        >
          <span className="material-symbols-outlined text-[15px] leading-none">
            {isLocating ? "hourglass_empty" : "near_me"}
          </span>
          <span>{isLocating ? t("places.locating") : t("places.near_me")}</span>
        </button>

        <button
          type="button"
          onClick={onOpenRandom}
          disabled={filteredPlacesCount === 0}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold whitespace-nowrap transition active:scale-95 shrink-0 cursor-pointer disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[15px] leading-none text-amber-500">
            casino
          </span>
          <span>{t("places.roulette")}</span>
        </button>
      </div>
    </section>
  );
}
