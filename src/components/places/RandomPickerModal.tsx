"use client";

import { useState, useEffect } from "react";
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

  function spin() {
    if (places.length === 0) return;
    setIsSpinning(true);

    let counter = 0;
    const totalFlips = 12;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * places.length);
      setSelectedPlace(places[randomIndex]);
      counter++;

      if (counter >= totalFlips) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 90);
  }

  useEffect(() => {
    if (isOpen && places.length > 0) {
      spin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center text-center">
        {/* Encabezado */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl mb-3 shadow-inner">
          <span
            className={`inline-block select-none transition-transform duration-150 ${
              isSpinning ? "animate-spin" : "scale-100"
            }`}
          >
            🎲
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t("random.title")}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t("random.subtitle", { count: places.length })}
        </p>

        {/* Tarjeta del sitio elegido */}
        {selectedPlace ? (
          <div
            className={`w-full my-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 transition-transform duration-150 ${
              isSpinning ? "scale-95 opacity-70" : "scale-100 opacity-100 shadow-md"
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              {selectedPlace.priceRange !== "???" ? selectedPlace.priceRange : t("random.free_price")}
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
              {selectedPlace.name}
            </h3>
            {(selectedPlace.city || selectedPlace.address) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                📍 {selectedPlace.city ? `${selectedPlace.city}` : ""}{" "}
                {selectedPlace.city && selectedPlace.address ? "•" : ""}{" "}
                {selectedPlace.address || ""}
              </p>
            )}

            {selectedPlace.occasions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                {selectedPlace.occasions.map((occ) => (
                  <span
                    key={occ}
                    className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200"
                  >
                    {occ}
                  </span>
                ))}
              </div>
            )}

            {selectedPlace.notes && (
              <p className="mt-3 text-xs italic text-slate-600 dark:text-slate-300">
                «<LinkifiedText text={selectedPlace.notes} />»
              </p>
            )}
          </div>
        ) : (
          <p className="my-6 text-sm text-slate-400">{t("random.no_places")}</p>
        )}

        {/* Acciones */}
        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            onClick={spin}
            disabled={isSpinning || places.length === 0}
            className="w-full py-3 px-4 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className={`inline-block text-base ${isSpinning ? "animate-spin" : ""}`}>
              🔄
            </span>
            <span>{isSpinning ? t("random.spinning") : t("random.spin_button")}</span>
          </button>

          {/* Opciones del sitio seleccionado */}
          {selectedPlace && (
            <div className="flex flex-col gap-2 w-full pt-1">
              <div className="grid grid-cols-2 gap-2 w-full">
                {onSelectInList && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectInList(selectedPlace.id);
                      onClose();
                    }}
                    className="py-2.5 px-3 rounded-xl font-semibold text-xs bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>📋</span>
                    <span>{t("random.view_in_list")}</span>
                  </button>
                )}

                {onSelectOnMap && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectOnMap(selectedPlace.id);
                      onClose();
                    }}
                    className="py-2.5 px-3 rounded-xl font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>🗺️</span>
                    <span>{t("random.view_on_map")}</span>
                  </button>
                )}
              </div>

              {selectedPlace.googleMapsUrl && (
                <a
                  href={selectedPlace.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition text-center flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700/60 shadow-2xs whitespace-nowrap"
                >
                  <span>📍</span>
                  <span>{t("random.open_maps")}</span>
                </a>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
