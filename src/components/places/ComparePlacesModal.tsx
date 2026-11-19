"use client";

import type { PlaceWithDetails } from "@/lib/actions/places";
import { useT } from "@/lib/i18n/client";

interface ComparePlacesModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: PlaceWithDetails[];
  occasionMap: Record<string, { name: string; icon: string }>;
  onRemovePlace: (placeId: string) => void;
  onSelectOnMap: (placeId: string) => void;
}

export function ComparePlacesModal({
  isOpen,
  onClose,
  places,
  occasionMap,
  onRemovePlace,
  onSelectOnMap,
}: ComparePlacesModalProps) {
  const { t } = useT();

  if (!isOpen || places.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150 text-left">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚖️</span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                {t("compare.title")} ({places.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("compare.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-5 overflow-auto flex-1">
          <div
            className={`grid gap-3 ${
              places.length === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-3"
            }`}
          >
            {places.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-black text-base text-slate-900 dark:text-slate-100 leading-snug">
                      {p.name}
                    </h4>
                    <button
                      type="button"
                      onClick={() => onRemovePlace(p.id)}
                      className="text-xs text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                      title={t("compare.remove_title")}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-200/70 dark:border-slate-700/60">
                      <span className="text-slate-500">{t("compare.price")}</span>
                      <span className="font-black text-emerald-700 dark:text-emerald-300">
                        {p.priceRange}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/70 dark:border-slate-700/60">
                      <span className="text-slate-500">{t("compare.city")}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                        {p.city || "—"}
                      </span>
                    </div>

                    {typeof p.distanceMeters === "number" && (
                      <div className="flex items-center justify-between py-1 border-b border-slate-200/70 dark:border-slate-700/60">
                        <span className="text-slate-500">{t("compare.distance")}</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {p.distanceMeters < 1000
                            ? `${p.distanceMeters} m`
                            : `${(p.distanceMeters / 1000).toFixed(1)} km`}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/70 dark:border-slate-700/60">
                      <span className="text-slate-500">{t("compare.my_rating")}</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {p.rating !== null && p.rating !== undefined ? `⭐ ${p.rating}/10` : t("compare.not_rated")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/70 dark:border-slate-700/60">
                      <span className="text-slate-500">{t("compare.experience")}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {p.experienceStatus === "visited_by_me"
                          ? `✅ ${t("cards.visited_badge")}`
                          : p.experienceStatus === "visited_by_others"
                          ? `👥 ${t("cards.friends_badge")}`
                          : `✨ ${t("cards.untried_badge")}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-200/70 dark:border-slate-700/60">
                      <span className="text-slate-500">{t("compare.comments")}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        💬 {p.commentsCount || 0}
                      </span>
                    </div>
                  </div>

                  {/* Planes */}
                  {p.occasions.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {p.occasions.map((occId) => {
                        const info = occasionMap[occId] || { name: occId, icon: "🏷️" };
                        return (
                          <span
                            key={occId}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300"
                          >
                            {info.icon} {info.name}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Tags */}
                  {p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.tags.slice(0, 6).map((tTag) => (
                        <span
                          key={tTag}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300"
                        >
                          #{tTag}
                        </span>
                      ))}
                    </div>
                  )}

                  {p.notes && (
                    <p className="text-[11px] italic text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/60 p-2 rounded-xl border-l-2 border-amber-500">
                      «{p.notes}»
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  {p.latitude != null && p.longitude != null && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectOnMap(p.id);
                      }}
                      className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer transition"
                    >
                      🗺️ {t("compare.view_on_map")}
                    </button>
                  )}
                  {p.googleMapsUrl && (
                    <a
                      href={p.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      {t("compare.open_maps")}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
