"use client";

import { useState, useMemo } from "react";
import type { PlaceWithDetails } from "@/lib/actions/places";
import { isValidGoogleMapsUrl } from "@/lib/maps";
import { EditPlaceModal } from "@/components/places/EditPlaceModal";
import { useT } from "@/lib/i18n/client";

type IssueFilter = "all" | "invalid_url" | "missing_coords" | "no_occasion" | "no_city";

interface DataHealthPanelProps {
  places: PlaceWithDetails[];
  occasionsList?: Array<{ id: string; name: string; icon: string }>;
}

export function DataHealthPanel({ places, occasionsList = [] }: DataHealthPanelProps) {
  const { t } = useT();
  const [filter, setFilter] = useState<IssueFilter>("all");
  const [editingPlace, setEditingPlace] = useState<PlaceWithDetails | null>(null);

  const issues = useMemo(() => {
    const list: Array<{
      place: PlaceWithDetails;
      invalidUrl: boolean;
      missingCoords: boolean;
      noOccasion: boolean;
      noCity: boolean;
    }> = [];

    for (const p of places) {
      const invalidUrl = Boolean(p.googleMapsUrl && !isValidGoogleMapsUrl(p.googleMapsUrl));
      const missingCoords = p.latitude == null || p.longitude == null;
      const noOccasion = !p.occasions || p.occasions.length === 0;
      const noCity = !p.city || !p.city.trim();
      if (invalidUrl || missingCoords || noOccasion || noCity) {
        list.push({ place: p, invalidUrl, missingCoords, noOccasion, noCity });
      }
    }
    return list;
  }, [places]);

  const counts = useMemo(
    () => ({
      all: issues.length,
      invalid_url: issues.filter((i) => i.invalidUrl).length,
      missing_coords: issues.filter((i) => i.missingCoords).length,
      no_occasion: issues.filter((i) => i.noOccasion).length,
      no_city: issues.filter((i) => i.noCity).length,
    }),
    [issues]
  );

  const visibleIssues = useMemo(() => {
    if (filter === "all") return issues;
    return issues.filter((i) => {
      if (filter === "invalid_url") return i.invalidUrl;
      if (filter === "missing_coords") return i.missingCoords;
      if (filter === "no_occasion") return i.noOccasion;
      if (filter === "no_city") return i.noCity;
      return true;
    });
  }, [issues, filter]);

  const availableTags = useMemo(
    () => Array.from(new Set(places.flatMap((p) => p.tags || []))),
    [places]
  );

  return (
    <div className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-4 text-left">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/70 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl leading-none">health_and_safety</span>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              {t("data_health.title")} ({issues.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("data_health.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros por tipo de incidencia */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { id: "all", label: `${t("places.all")} (${counts.all})` },
            { id: "invalid_url", label: `${t("data_health.issue_invalid_url")} (${counts.invalid_url})` },
            { id: "missing_coords", label: `${t("data_health.issue_missing_coords")} (${counts.missing_coords})` },
            { id: "no_occasion", label: `${t("data_health.issue_no_occasion")} (${counts.no_occasion})` },
            { id: "no_city", label: `${t("data_health.issue_no_city")} (${counts.no_city})` },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
              filter === item.id
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visibleIssues.length === 0 ? (
        <div className="p-6 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/50 text-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
          ✓ {t("data_health.all_clean")}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleIssues.map(({ place, invalidUrl, missingCoords, noOccasion, noCity }) => (
            <div
              key={place.id}
              className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                    {place.name}
                  </span>
                  {place.groupName && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/70 dark:border-orange-800/60">
                      {place.groupIcon || "🍻"} {place.groupName}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {invalidUrl && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
                      {t("data_health.issue_invalid_url")}
                    </span>
                  )}
                  {missingCoords && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                      {t("data_health.issue_missing_coords")}
                    </span>
                  )}
                  {noOccasion && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                      {t("data_health.issue_no_occasion")}
                    </span>
                  )}
                  {noCity && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                      {t("data_health.issue_no_city")}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingPlace(place)}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white transition cursor-pointer shrink-0 self-start sm:self-center"
              >
                <span className="material-symbols-outlined text-sm leading-none">edit</span>
                <span>{t("common.edit")}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {editingPlace && (
        <EditPlaceModal
          place={editingPlace}
          occasionsList={occasionsList}
          availableTags={availableTags}
          isOpen={true}
          onClose={() => setEditingPlace(null)}
        />
      )}
    </div>
  );
}
