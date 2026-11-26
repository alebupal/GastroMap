"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PublicGuideData } from "@/lib/actions/lists";
import type { PlaceWithDetails } from "@/lib/actions/places";
import { MapContainerWrapper } from "@/components/map/MapContainerWrapper";
import { GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { LinkifiedText } from "@/components/ui/LinkifiedText";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n/client";

const PRICE_RANGE_LABELS: Record<string, string> = {
  "€": "< 20 €",
  "€€": "20-30 €",
  "€€€": "30-40 €",
  "€€€€": "> 40 €",
  "???": "???",
};

interface PublicGuideViewProps {
  guide: PublicGuideData;
}

export function PublicGuideView({ guide }: PublicGuideViewProps) {
  const { t } = useT();
  const { toast } = useToast();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const authorHandle = guide.authorUsername ? `@${guide.authorUsername}` : guide.authorName;

  // Adaptamos los ítems públicos al formato esperado por MapView (solo datos públicos)
  const mapPlaces = useMemo<PlaceWithDetails[]>(() => {
    const now = new Date();
    return guide.items.map((item) => ({
      id: item.placeId,
      groupId: null,
      name: item.name,
      address: item.address,
      city: item.city,
      country: null,
      latitude: item.latitude,
      longitude: item.longitude,
      googleMapsUrl: item.googleMapsUrl,
      priceRange: item.priceRange,
      notes: item.notes,
      communityPublished: true,
      website: null,
      phone: null,
      googlePlaceId: null,
      mapsUrlKey: null,
      deletedAt: null,
      createdById: "",
      createdAt: now,
      updatedAt: now,
      createdByName: guide.authorName,
      createdByUsername: guide.authorUsername,
      occasions: item.occasions,
      tags: item.tags,
      isFavorite: false,
      personalStatus: null,
      rating: null,
      privateNotes: null,
      commentsCount: 0,
    }));
  }, [guide]);

  const mappableItems = useMemo(
    () => guide.items.filter((item) => item.latitude != null && item.longitude != null),
    [guide.items]
  );

  // Construye URL de ruta en Google Maps cuando hay al menos 2 paradas con coordenadas
  const googleRouteUrl = useMemo(() => {
    if (mappableItems.length < 2) return null;
    const limited = mappableItems.slice(0, 11); // origin + hasta 9 waypoints + destination
    const first = limited[0];
    const last = limited[limited.length - 1];
    const waypoints = limited
      .slice(1, -1)
      .map((p) => `${p.latitude},${p.longitude}`)
      .join("|");
    const params = new URLSearchParams({
      api: "1",
      origin: `${first.latitude},${first.longitude}`,
      destination: `${last.latitude},${last.longitude}`,
    });
    if (waypoints) params.set("waypoints", waypoints);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [mappableItems]);

  async function handleCopyLink() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("lists.link_copied_toast"), { kind: "success" });
    } catch {
      // Fallback silencioso
    }
  }

  async function handleShare() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const text = `${guide.name} — GastroMap`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: guide.name, text, url });
        return;
      } catch {
        // Cancelado por el usuario
        return;
      }
    }
    await handleCopyLink();
  }

  function handleWhatsApp() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const text = `${guide.name} — ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function focusPlaceOnMap(placeId: string) {
    setSelectedPlaceId(placeId);
    const mapEl = document.getElementById("public-guide-map");
    if (mapEl && window.innerWidth < 1024) {
      mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9ff] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Cabecera pública */}
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center group shrink-0">
            <GastroMapLogo
              iconClassName="w-8 h-8 group-hover:scale-105 transition-transform"
              textClassName="text-lg"
            />
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSelector />
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-xs"
            >
              <span className="material-symbols-outlined text-sm leading-none">explore</span>
              <span>{t("lists.back_to_gastromap")}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Hero de la guía */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-7">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-200/60 dark:border-orange-800/50">
                <span className="material-symbols-outlined text-2xl sm:text-3xl leading-none">
                  {guide.icon || "bookmark"}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                    <span className="material-symbols-outlined text-[13px] leading-none">public</span>
                    <span>{t("lists.public_guide_badge")}</span>
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t("lists.public_guide_by", { author: authorHandle })}
                  </span>
                  <span className="text-xs text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                    {t("lists.places_count", { count: guide.items.length })}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight break-words">
                  {guide.name}
                </h1>
                {guide.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                    {guide.description}
                  </p>
                )}
              </div>
            </div>

            {/* Acciones rápidas de la guía */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {googleRouteUrl && (
                <a
                  href={googleRouteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-xs"
                >
                  <span className="material-symbols-outlined text-base leading-none">route</span>
                  <span>{t("lists.open_google_route")}</span>
                </a>
              )}
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-base leading-none">share</span>
                <span>{t("lists.share_guide")}</span>
              </button>
              <button
                type="button"
                onClick={handleWhatsApp}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/50 text-xs font-bold transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-base leading-none">chat</span>
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </section>

        {/* Contenido: Lista numerada + Mapa interactivo */}
        {guide.items.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">
              bookmark_border
            </span>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {t("lists.no_places_in_list")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Mapa: arriba en móvil, sticky a la derecha en escritorio */}
            {mappableItems.length > 0 && (
              <div
                id="public-guide-map"
                className="lg:col-span-6 lg:order-2 lg:sticky lg:top-20 rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 h-[300px] sm:h-[380px] lg:h-[calc(100vh-7rem)]"
              >
                <MapContainerWrapper
                  places={mapPlaces}
                  selectedPlaceId={selectedPlaceId}
                  onSelectPlace={(id) => setSelectedPlaceId(id)}
                  occasionMap={guide.occasionMap}
                  isFiltered={true}
                />
              </div>
            )}

            {/* Tarjetas numeradas de paradas */}
            <div className={`${mappableItems.length > 0 ? "lg:col-span-6 lg:order-1" : "lg:col-span-12"} space-y-3`}>
              {guide.items.map((item, idx) => {
                const isSelected = selectedPlaceId === item.placeId;
                const hasCoords = item.latitude != null && item.longitude != null;
                const mapsHref =
                  item.googleMapsUrl ||
                  (hasCoords
                    ? `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`
                    : null);

                return (
                  <article
                    key={item.itemId}
                    className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition shadow-xs ${
                      isSelected
                        ? "border-orange-500 ring-2 ring-orange-500/30 shadow-md"
                        : "border-slate-200/80 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-800/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-full bg-orange-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {idx + 1}
                        </span>
                        <h2 className="font-bold text-slate-900 dark:text-white text-base leading-snug break-words">
                          {item.name}
                        </h2>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#6ffbbe] text-[#005236] font-bold text-[11px] shrink-0">
                        {PRICE_RANGE_LABELS[item.priceRange] || item.priceRange}
                      </span>
                    </div>

                    {(item.city || item.address) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1 min-w-0">
                        <span className="material-symbols-outlined text-sm text-orange-600 leading-none shrink-0">
                          location_on
                        </span>
                        <span className="truncate">
                          {item.city ? item.city : ""}
                          {item.city && item.address ? " • " : ""}
                          {item.address || ""}
                        </span>
                      </p>
                    )}

                    {(item.occasions.length > 0 || item.tags.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        {item.occasions.map((occId) => {
                          const occ = guide.occasionMap[occId];
                          if (!occ) return null;
                          return (
                            <span
                              key={occId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold"
                            >
                              <OccasionIcon icon={occ.icon} className="text-xs" />
                              <span>{occ.name}</span>
                            </span>
                          );
                        })}
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-[11px] font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.notes && (
                      <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/50 border-l-2 border-orange-400 px-3 py-2 rounded-r-xl leading-relaxed">
                        «<LinkifiedText text={item.notes} />»
                      </p>
                    )}

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                      {hasCoords && (
                        <button
                          type="button"
                          onClick={() => focusPlaceOnMap(item.placeId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm leading-none">explore</span>
                          <span>{t("cards.view_on_map")}</span>
                        </button>
                      )}
                      {mapsHref && (
                        <a
                          href={mapsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          <span className="material-symbols-outlined text-sm leading-none">open_in_new</span>
                          <span>Google Maps</span>
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
