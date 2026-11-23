"use client";

import { useEffect, useMemo } from "react";
import type { PlaceWithDetails } from "@/lib/actions/places";
import { useT } from "@/lib/i18n/client";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { LinkifiedText } from "@/components/ui/LinkifiedText";
import { GastroMapIcon } from "@/components/ui/GastroMapLogo";

interface ComparePlacesModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: PlaceWithDetails[];
  occasionMap: Record<string, { name: string; icon: string }>;
  onRemovePlace: (placeId: string) => void;
  onSelectOnMap: (placeId: string) => void;
  onClearAll?: () => void;
}

const PRICE_RANK: Record<string, number> = {
  "€": 1,
  "€€": 2,
  "€€€": 3,
  "€€€€": 4,
};

function formatPriceBracket(priceRange: string | null | undefined) {
  switch (priceRange) {
    case "€":
      return "< 15 € (€)";
    case "€€":
      return "15 - 30 € (€€)";
    case "€€€":
      return "30 - 50 € (€€€)";
    case "€€€€":
      return "> 50 € (€€€€)";
    default:
      return "Precio libre";
  }
}

const AVATAR_STYLES = [
  "bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300",
  "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300",
  "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300",
];

export function ComparePlacesModal({
  isOpen,
  onClose,
  places,
  occasionMap,
  onRemovePlace,
  onSelectOnMap,
  onClearAll,
}: ComparePlacesModalProps) {
  const { t } = useT();

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const verdict = useMemo(() => {
    if (places.length === 0) return null;

    // 1. Opción más económica
    const withPrice = places.filter((p) => p.priceRange && PRICE_RANK[p.priceRange]);
    const cheapest =
      withPrice.length > 0
        ? [...withPrice].sort((a, b) => (PRICE_RANK[a.priceRange!] || 9) - (PRICE_RANK[b.priceRange!] || 9))[0]
        : null;

    // 2. Mejor valorado o más comentado
    const topActivity = [...places].sort((a, b) => {
      const scoreA = (a.rating || 0) * 10 + (a.commentsCount || 0);
      const scoreB = (b.rating || 0) * 10 + (b.commentsCount || 0);
      return scoreB - scoreA;
    })[0];

    // 3. Más cercano o por descubrir
    const withDist = places.filter((p) => typeof p.distanceMeters === "number");
    const closest =
      withDist.length > 0
        ? [...withDist].sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999))[0]
        : places.find((p) => p.personalStatus !== "visited") || places[0];

    return { cheapest, topActivity, closest, hasDistances: withDist.length > 0 };
  }, [places]);

  // URL de ruta multi-parada en Google Maps
  const routeUrl = useMemo(() => {
    const withCoords = places.filter((p) => p.latitude != null && p.longitude != null);
    if (withCoords.length === 0) return null;
    if (withCoords.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${withCoords[0].latitude},${withCoords[0].longitude}`;
    }
    const destination = withCoords[withCoords.length - 1];
    const waypoints = withCoords
      .slice(0, -1)
      .map((p) => `${p.latitude},${p.longitude}`)
      .join("|");
    return `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&waypoints=${encodeURIComponent(waypoints)}&travelmode=walking`;
  }, [places]);

  if (!isOpen || places.length === 0) return null;

  return (
    <div
      className="fixed inset-0 !mt-0 z-[1100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150 text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Cabecera estilo Stitch */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <GastroMapIcon className="w-9 h-9 rounded-[28%] shrink-0 shadow-xs" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100 tracking-tight">
                  {t("compare.title")}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-800 dark:text-orange-300 text-[10px] font-extrabold">
                  • {places.length} {places.length === 1 ? "local" : "locales"} (máx. 3)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {t("compare.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onClearAll && (
              <button
                type="button"
                onClick={onClearAll}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm leading-none">delete_sweep</span>
                <span>{t("ui.clear_compare")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
              aria-label="Cerrar comparativa"
            >
              <span className="material-symbols-outlined text-lg leading-none">close</span>
            </button>
          </div>
        </div>

        {/* Contenido scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Columnas comparadas */}
          <div
            className={`grid gap-4 ${
              places.length === 1
                ? "grid-cols-1 max-w-md mx-auto"
                : places.length === 2
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1 md:grid-cols-3"
            }`}
          >
            {places.map((p, idx) => {
              const initials = p.name
                .split(/\s+/)
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const avatarStyle = AVATAR_STYLES[idx % AVATAR_STYLES.length];
              const walkMins =
                typeof p.distanceMeters === "number"
                  ? Math.max(1, Math.round(p.distanceMeters / 80))
                  : null;

              return (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-[#f4f5ff]/85 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3.5">
                    {/* Cabecera de tarjeta */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl font-black text-base flex items-center justify-center shrink-0 ${avatarStyle}`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 leading-tight line-clamp-2">
                            {p.name}
                          </h4>
                          {(p.address || p.city) && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-0.5 truncate">
                              <span className="material-symbols-outlined text-xs text-orange-600 shrink-0">
                                location_on
                              </span>
                              <span className="truncate">{p.address || p.city}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemovePlace(p.id)}
                        className="w-7 h-7 rounded-full hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer shrink-0"
                        title={t("compare.remove_title")}
                      >
                        <span className="material-symbols-outlined text-sm leading-none">close</span>
                      </button>
                    </div>

                    {/* 2 cajas blancas: Distancia/Ciudad y Precio */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-700/60">
                        <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                          {typeof p.distanceMeters === "number" ? t("compare.distance") : t("compare.city")}
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                          {typeof p.distanceMeters === "number" ? (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              {p.distanceMeters < 1000
                                ? `${p.distanceMeters} m`
                                : `${(p.distanceMeters / 1000).toFixed(1)} km`}
                              {walkMins && walkMins <= 45 ? ` (${walkMins} min)` : ""}
                            </span>
                          ) : (
                            p.city || "—"
                          )}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-700/60">
                        <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                          {t("compare.price")}
                        </div>
                        <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5 truncate">
                          {formatPriceBracket(p.priceRange)}
                        </div>
                      </div>
                    </div>

                    {/* Estado y plan */}
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                        Estado y plan
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.personalStatus === "visited"
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                              : p.personalStatus === "pending"
                                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                                : "bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300"
                          }`}
                        >
                          {p.personalStatus === "visited"
                            ? `✅ ${t("cards.visited")}`
                            : p.personalStatus === "pending"
                              ? `🕒 ${t("places.want_to_go")}`
                              : `✨ ${t("cards.untried_badge")}`}
                        </span>
                        {p.occasions.slice(0, 3).map((occId) => {
                          const info = occasionMap[occId] || { name: occId, icon: "🍽️" };
                          return (
                            <span
                              key={occId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                            >
                              <OccasionIcon icon={info.icon} msClassName="text-[12px]" />
                              <span>{info.name}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Especialidades / Etiquetas */}
                    {p.tags.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                          {t("ui.specialty")}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {p.tags.slice(0, 5).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bloque blanco de notas y valoración */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-500 dark:text-slate-400">
                          💬 {p.commentsCount || 0} {t("compare.comments").toLowerCase()}
                        </span>
                        <span className="text-amber-600 dark:text-amber-400">
                          {p.rating !== null && p.rating !== undefined
                            ? `★ ${p.rating}/10`
                            : "Sin nota"}
                        </span>
                      </div>
                      {p.notes ? (
                        <p className="text-[11px] italic text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                          &laquo;<LinkifiedText text={p.notes} />&raquo;
                        </p>
                      ) : (
                        <p className="text-[11px] italic text-slate-400">
                          Sin descripción registrada.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Botones de acción de tarjeta */}
                  <div className="flex items-center gap-2 pt-1">
                    {p.latitude != null && p.longitude != null && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onSelectOnMap(p.id);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer transition"
                      >
                        <span className="material-symbols-outlined text-sm text-orange-600 leading-none">
                          map
                        </span>
                        <span>{t("compare.view_on_map")}</span>
                      </button>
                    )}
                    {p.googleMapsUrl && (
                      <a
                        href={p.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-orange-100/90 dark:bg-orange-950/60 hover:bg-orange-200 dark:hover:bg-orange-900/60 text-orange-800 dark:text-orange-200 font-bold text-xs transition shrink-0"
                      >
                        <span className="material-symbols-outlined text-sm leading-none">
                          open_in_new
                        </span>
                        <span>Maps</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Veredicto Rápido de GastroMap */}
          {verdict && places.length >= 2 && (
            <div className="rounded-2xl bg-[#f2f3ff] dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-slate-100">
                <span className="material-symbols-outlined text-base text-orange-600 leading-none">
                  auto_awesome
                </span>
                <span>{t("ui.quick_verdict", { count: places.length })}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {verdict.topActivity && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                    <div className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <span>⭐</span>
                      <span>Más destacado:</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      <strong>{verdict.topActivity.name}</strong> lidera en actividad con{" "}
                      {verdict.topActivity.commentsCount || 0} comentarios
                      {verdict.topActivity.rating ? ` y nota ${verdict.topActivity.rating}/10` : ""}.
                    </p>
                  </div>
                )}

                {verdict.cheapest && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                    <div className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <span>⚡</span>
                      <span>Opción más económica:</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      <strong>{verdict.cheapest.name}</strong> ({formatPriceBracket(verdict.cheapest.priceRange)}).
                    </p>
                  </div>
                )}

                {verdict.closest && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                    <div className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                      <span>{verdict.hasDistances ? "📍" : "✨"}</span>
                      <span>{verdict.hasDistances ? "Más cercano:" : "Para descubrir:"}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      <strong>{verdict.closest.name}</strong>
                      {verdict.hasDistances && typeof verdict.closest.distanceMeters === "number"
                        ? ` a solo ${
                            verdict.closest.distanceMeters < 1000
                              ? `${verdict.closest.distanceMeters} m`
                              : `${(verdict.closest.distanceMeters / 1000).toFixed(1)} km`
                          }.`
                        : " es ideal para tachar un nuevo descubrimiento."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pie del modal estilo Stitch */}
        <div className="px-5 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="material-symbols-outlined text-base text-emerald-600 leading-none">
              check_circle
            </span>
            <span>
              {places.length >= 3
                ? "Capacidad máxima alcanzada (3 de 3 locales seleccionados)"
                : `${places.length} de 3 locales seleccionados`}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
            >
              {t("common.close")}
            </button>
            {routeUrl && (
              <a
                href={routeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition"
              >
                <span className="material-symbols-outlined text-base leading-none">alt_route</span>
                <span>{t("ui.start_food_route")}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
