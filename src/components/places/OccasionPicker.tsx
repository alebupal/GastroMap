"use client";

import { useState, useMemo } from "react";
import { useT } from "@/lib/i18n/client";

const INITIAL_VISIBLE = 10;
const LOAD_MORE_STEP = 12;

export interface OccasionOption {
  id: string;
  name: string;
  icon: string;
  placesCount?: number;
}

interface OccasionPickerProps {
  occasions: OccasionOption[];
  selectedOccasions: string[];
  onToggle: (id: string) => void;
  label?: string;
  renderHiddenInputs?: boolean;
}

export function OccasionPicker({
  occasions,
  selectedOccasions,
  onToggle,
  label,
  renderHiddenInputs = false,
}: OccasionPickerProps) {
  const { t } = useT();
  const displayLabel = label || t("places.plans_title");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Ordenar por frecuencia de uso (más usadas primero)
  const sortedOccasions = useMemo(() => {
    return [...occasions].sort(
      (a, b) => (b.placesCount || 0) - (a.placesCount || 0) || a.name.localeCompare(b.name, "es")
    );
  }, [occasions]);

  const q = searchQuery.trim().toLowerCase();

  const filteredOccasions = useMemo(() => {
    if (!q) return sortedOccasions;
    return sortedOccasions.filter(
      (occ) => occ.name.toLowerCase().includes(q) || occ.id.toLowerCase().includes(q)
    );
  }, [sortedOccasions, q]);

  const displayedOccasions = useMemo(() => {
    if (q) return filteredOccasions;
    const slice = filteredOccasions.slice(0, visibleCount);
    // Garantizar que las seleccionadas siempre sean visibles
    const sliceIds = new Set(slice.map((o) => o.id));
    selectedOccasions.forEach((selId) => {
      if (!sliceIds.has(selId)) {
        const found = sortedOccasions.find((o) => o.id === selId);
        if (found) slice.unshift(found);
      }
    });
    return slice;
  }, [filteredOccasions, sortedOccasions, selectedOccasions, q, visibleCount]);

  const remainingCount = q ? 0 : Math.max(0, filteredOccasions.length - visibleCount);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {displayLabel} ({occasions.length})
        </label>
        {selectedOccasions.length > 0 && (
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
            {selectedOccasions.length === 1
              ? t("form.occasions_selected_single", { count: selectedOccasions.length })
              : t("form.occasions_selected_multiple", { count: selectedOccasions.length })}
          </span>
        )}
      </div>

      <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
        {occasions.length > 6 && (
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-xs text-slate-400 pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("form.occasions_search_placeholder")}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {displayedOccasions.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic py-1">
              {q ? t("form.occasions_no_results", { query: searchQuery }) : t("form.occasions_empty")}
            </p>
          ) : (
            displayedOccasions.map((occ) => {
              const active = selectedOccasions.includes(occ.id);
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => onToggle(occ.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1 ${active
                    ? "bg-amber-500 border-amber-500 text-slate-950 font-bold shadow-xs"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                >
                  <span>{occ.icon}</span>
                  <span>{occ.name}</span>
                  {active && <span className="text-[10px] font-extrabold">✓</span>}
                </button>
              );
            })
          )}
        </div>

        {!q && (remainingCount > 0 || visibleCount > INITIAL_VISIBLE) && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-700/50 text-[11px]">
            {remainingCount > 0 ? (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_STEP)}
                className="font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                {t("places.show_more_remaining", { count: remainingCount })}
              </button>
            ) : (
              <span className="text-slate-400">{t("places.showing_all_categories")}</span>
            )}

            {visibleCount > INITIAL_VISIBLE && (
              <button
                type="button"
                onClick={() => setVisibleCount(INITIAL_VISIBLE)}
                className="font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
              >
                {t("places.show_less")}
              </button>
            )}
          </div>
        )}
      </div>

      {renderHiddenInputs &&
        selectedOccasions.map((id) => (
          <input key={id} type="hidden" name="occasions" value={id} />
        ))}
    </div>
  );
}
