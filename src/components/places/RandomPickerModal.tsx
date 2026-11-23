"use client";

import { useState, useEffect, useMemo } from "react";
import type { PlaceWithDetails } from "@/lib/actions/places";
import { useT } from "@/lib/i18n/client";
import { LinkifiedText } from "@/components/ui/LinkifiedText";

interface RandomPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: PlaceWithDetails[];
  onSelectOnMap?: (placeId: string) => void;
  onSelectInList?: (placeId: string) => void;
}

function formatPriceLabel(priceRange: string | null | undefined, fallback: string) {
  switch (priceRange) {
    case "€":
      return "< 15 €";
    case "€€":
      return "15 - 30 €";
    case "€€€":
      return "30 - 50 €";
    case "€€€€":
      return "> 50 €";
    default:
      return fallback;
  }
}

export function RandomPickerModal({
  isOpen,
  onClose,
  places,
  onSelectOnMap,
  onSelectInList,
}: RandomPickerModalProps) {
  const { t } = useT();
  const [selectedPlace, setSelectedPlace] = useState<PlaceWithDetails | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [excludeVisited, setExcludeVisited] = useState(false);

  const eligiblePlaces = useMemo(() => {
    if (!excludeVisited) return places;
    return places.filter((p) => p.personalStatus !== "visited");
  }, [places, excludeVisited]);

  function spin(pool: PlaceWithDetails[] = eligiblePlaces) {
    if (pool.length === 0) {
      setSelectedPlace(null);
      return;
    }
    setIsSpinning(true);

    let counter = 0;
    const totalFlips = 12;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * pool.length);
      setSelectedPlace(pool[randomIndex]);
      counter++;

      if (counter >= totalFlips) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 85);
  }

  useEffect(() => {
    if (isOpen) {
      spin(eligiblePlaces);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, excludeVisited]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const initials = selectedPlace
    ? selectedPlace.name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "GM";

  return (
    <div
      className="fixed inset-0 !mt-0 z-[1100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 overflow-hidden space-y-5">
        {/* Brillo cálido decorativo superior derecho */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-orange-200/40 dark:bg-orange-900/20 blur-3xl"
        />

        {/* Cabecera estilo Stitch */}
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100/90 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-[10px] font-black uppercase tracking-wider">
              <span
                className={`inline-block leading-none ${isSpinning ? "animate-spin" : ""}`}
              >
                🎲
              </span>
              <span>{t("ui.indecision_mode")}</span>
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-2">
              {t("random.title")}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t("random.subtitle", { count: eligiblePlaces.length })}
            </p>
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

        {/* Universo de decisión */}
        <div className="relative space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("ui.decision_universe")}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer text-[11px]"
            >
              {t("ui.modify_filters")}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              <span className="material-symbols-outlined text-xs text-orange-600">location_on</span>
              <span>{eligiblePlaces.length} locales disponibles</span>
            </span>
            {excludeVisited && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100/90 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300">
                <span>✨</span>
                <span>Solo &quot;Por descubrir&quot;</span>
              </span>
            )}
          </div>
        </div>

        {/* Tarjeta del destino recomendado */}
        {selectedPlace ? (
          <div className="relative pt-2">
            {/* Insignia flotante superior derecha */}
            <div className="absolute -top-0.5 right-4 z-10 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-xs">
              <span>✨</span>
              <span>{t("ui.recommended_dest")}</span>
            </div>

            <div
              className={`rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 p-4 sm:p-5 space-y-3.5 transition-all duration-150 ${
                isSpinning ? "scale-[0.98] opacity-75" : "scale-100 opacity-100 shadow-sm"
              }`}
            >
              <div className="flex items-start gap-3.5">
                {/* Avatar de iniciales naranja oficial con insignia de cubiertos */}
                <div className="relative w-16 h-16 rounded-2xl bg-orange-600 text-white font-black text-2xl flex items-center justify-center shrink-0 shadow-md shadow-orange-600/20">
                  {initials}
                  <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-orange-600 flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-xs leading-none">restaurant</span>
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-tight truncate">
                      {selectedPlace.name}
                    </h3>
                    {selectedPlace.rating !== null && selectedPlace.rating !== undefined && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-black shrink-0">
                        ★ {selectedPlace.rating}/10
                      </span>
                    )}
                  </div>

                  {(selectedPlace.city || selectedPlace.address) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                      <span className="material-symbols-outlined text-xs text-slate-400 shrink-0">near_me</span>
                      <span className="truncate">
                        {selectedPlace.address || selectedPlace.city}
                        {selectedPlace.address && selectedPlace.city && !selectedPlace.address.includes(selectedPlace.city)
                          ? `, ${selectedPlace.city}`
                          : ""}
                      </span>
                    </p>
                  )}

                  {/* Chips de precio, ocasiones y comunidad */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[10px] font-bold">
                    <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                      {formatPriceLabel(selectedPlace.priceRange, t("random.free_price"))}
                    </span>
                    {selectedPlace.occasions.slice(0, 2).map((occ) => (
                      <span
                        key={occ}
                        className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      >
                        {occ}
                      </span>
                    ))}
                    {selectedPlace.isFavorite ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                        <span>⭐</span>
                        <span>{t("ui.in_favorites")}</span>
                      </span>
                    ) : selectedPlace.personalStatus === "visited" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                        <span>✅</span>
                        <span>{t("ui.already_tried")}</span>
                      </span>
                    ) : selectedPlace.personalStatus === "pending" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                        <span>🕒</span>
                        <span>{t("ui.in_wishlist")}</span>
                      </span>
                    ) : !selectedPlace.communityPublished ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                        <span>🔒</span>
                        <span>{t("ui.private_card")}</span>
                      </span>
                    ) : (selectedPlace.commentsCount || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                        <span>💬</span>
                        <span>
                          {selectedPlace.commentsCount} {t("compare.comments").toLowerCase()}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300">
                        <span>✨</span>
                        <span>{t("places.unexplored")}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notas / recomendaciones del sitio */}
              {selectedPlace.notes && (
                <div className="rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-700/70 p-3 flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-sm leading-none">restaurant_menu</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      Notas y recomendaciones
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed line-clamp-3">
                      <LinkifiedText text={selectedPlace.notes} />
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 p-8 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {t("random.no_places")}
            </p>
          </div>
        )}

        {/* Botón principal ¡Girar de nuevo! */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => spin()}
            disabled={isSpinning || eligiblePlaces.length === 0}
            className="w-full py-3.5 px-5 rounded-full font-extrabold text-sm bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/25 transition active:scale-[0.99] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className={`material-symbols-outlined text-lg leading-none ${isSpinning ? "animate-spin" : ""}`}>
              casino
            </span>
            <span>{isSpinning ? t("random.spinning") : t("random.spin_button")}</span>
          </button>

          {/* 3 botones secundarios estilo Stitch */}
          {selectedPlace && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {onSelectOnMap && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectOnMap(selectedPlace.id);
                    onClose();
                  }}
                  className="py-2.5 px-2.5 rounded-2xl font-bold text-xs bg-[#f2f3ff] hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm text-orange-600 leading-none">map</span>
                  <span className="truncate">{t("random.view_on_map")}</span>
                </button>
              )}

              {onSelectInList && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectInList(selectedPlace.id);
                    onClose();
                  }}
                  className="py-2.5 px-2.5 rounded-2xl font-bold text-xs bg-[#f2f3ff] hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm text-slate-600 dark:text-slate-300 leading-none">list_alt</span>
                  <span className="truncate">{t("random.view_in_list")}</span>
                </button>
              )}

              {selectedPlace.googleMapsUrl ? (
                <a
                  href={selectedPlace.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-2.5 rounded-2xl font-bold text-xs bg-[#f2f3ff] hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm text-emerald-600 leading-none">open_in_new</span>
                  <span className="truncate">Maps</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-2.5 rounded-2xl font-bold text-xs bg-[#f2f3ff] hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span>{t("common.close")}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Interruptor inferior: excluir sitios ya visitados */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span className="material-symbols-outlined text-base text-slate-400 leading-none">history</span>
            <span>{t("ui.exclude_visited")}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={excludeVisited}
            onClick={() => setExcludeVisited((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
              excludeVisited ? "bg-orange-600" : "bg-slate-300 dark:bg-slate-700"
            }`}
            aria-label={t("ui.exclude_visited")}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                excludeVisited ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
