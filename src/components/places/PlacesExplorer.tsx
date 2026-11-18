"use client";

import { useState, useMemo } from "react";
import { PlaceCard } from "./PlaceCard";
import { MapContainerWrapper } from "@/components/map/MapContainerWrapper";
import { RandomPickerModal } from "./RandomPickerModal";
import { DecisionAssistantModal } from "./DecisionAssistantModal";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import type { PlaceWithDetails } from "@/lib/actions/places";

interface PlacesExplorerProps {
  initialPlaces: PlaceWithDetails[];
  occasionsList: Array<{ id: string; name: string; icon: string; placesCount?: number }>;
  tagsList: { id: string; name: string; placesCount: number }[];
  currentUserId: string;
  isAdmin: boolean;
  occasionMap: Record<string, { name: string; icon: string }>;
  cartoApiKey?: string | null;
}

/**
 * Fórmula de Haversine para cálculo instantáneo de distancia en cliente
 */
function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function PlacesExplorer({
  initialPlaces,
  occasionsList,
  tagsList,
  currentUserId,
  isAdmin,
  occasionMap,
  cartoApiKey,
}: PlacesExplorerProps) {
  // En móvil: alternar entre vista lista o mapa. En desktop: ambas se muestran simultáneamente.
  const [activeMobileView, setActiveMobileView] = useState<"list" | "map">("map");
  // Filtros acumulables
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [textSearch, setTextSearch] = useState<string>("");

  // Asistente y filtros avanzados (Fase 4)
  const [isRandomModalOpen, setIsRandomModalOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [experienceFilter, setExperienceFilter] = useState<
    "all" | "visited_by_me" | "visited_by_others" | "untried" | "favorite" | "pending"
  >("all");

  // Geolocalización
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);

  // Estados de vista adaptativa para evitar problemas de espacio con muchas categorías o tags
  const [isOccasionsWrapped, setIsOccasionsWrapped] = useState(false);
  const [isOccasionSearchOpen, setIsOccasionSearchOpen] = useState(false);
  const [occasionSearchQuery, setOccasionSearchQuery] = useState("");
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");

  // Alternar selección de ocasión acumulable
  function toggleOccasion(occId: string) {
    setSelectedOccasions((prev) =>
      prev.includes(occId) ? prev.filter((id) => id !== occId) : [...prev, occId]
    );
  }

  // Alternar selección de etiqueta acumulable
  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }

  // Alternar selección de precio acumulable
  function togglePrice(price: string) {
    setSelectedPrices((prev) =>
      prev.includes(price) ? prev.filter((p) => p !== price) : [...prev, price]
    );
  }

  // Solicitar ubicación al navegador
  function handleRequestLocation() {
    if (!navigator.geolocation) {
      setLocationError("Tu navegador no soporta geolocalización.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setIsLocating(false);
        if (!radiusKm) setRadiusKm(5);
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Permiso de ubicación denegado.");
        } else {
          setLocationError("No se pudo obtener tu ubicación.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  function handleDisableLocation() {
    setUserLocation(null);
    setRadiusKm(null);
    setLocationError(null);
  }

  function resetAllFilters() {
    setSelectedOccasions([]);
    setSelectedTags([]);
    setSelectedPrices([]);
    setExperienceFilter("all");
    setTextSearch("");
    setUserLocation(null);
    setRadiusKm(null);
    setOccasionSearchQuery("");
    setTagSearchQuery("");
  }

  // Filtrado y cálculo de distancias
  const filteredPlaces = useMemo(() => {
    let result = initialPlaces.map((place) => {
      let distanceMeters = place.distanceMeters ?? null;

      if (
        userLocation &&
        place.latitude != null &&
        place.longitude != null
      ) {
        distanceMeters = calculateDistanceMeters(
          userLocation.latitude,
          userLocation.longitude,
          place.latitude,
          place.longitude
        );
      }

      return {
        ...place,
        distanceMeters,
      };
    });

    // 0. Búsqueda por texto libre
    if (textSearch.trim().length > 0) {
      const q = textSearch.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.city && p.city.toLowerCase().includes(q)) ||
          (p.address && p.address.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q)) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          p.occasions.some((occ) => occ.toLowerCase().includes(q))
      );
    }

    // 1. Filtro por Ocasiones acumulables (OR entre ocasiones seleccionadas)
    if (selectedOccasions.length > 0) {
      result = result.filter((p) =>
        p.occasions.some((occ) => selectedOccasions.includes(occ))
      );
    }

    // 2. Filtro por Etiquetas acumulables (AND entre etiquetas para refinar búsqueda)
    if (selectedTags.length > 0) {
      result = result.filter((p) =>
        selectedTags.every((t) => p.tags.includes(t))
      );
    }

    // 3. Filtro por Precios acumulables (OR entre precios seleccionados, ej. € y €€)
    if (selectedPrices.length > 0) {
      result = result.filter(
        (p) => selectedPrices.includes(p.priceRange) || p.priceRange === "???"
      );
    }

    // 4. Filtro por Experiencia / Colección Personal
    if (experienceFilter === "favorite") {
      result = result.filter((p) => p.isFavorite === true);
    } else if (experienceFilter === "pending") {
      result = result.filter((p) => p.personalStatus === "pending");
    } else if (experienceFilter === "visited_by_me") {
      result = result.filter(
        (p) => p.personalStatus === "visited" || (p.rating !== null && (p.rating ?? 0) > 0)
      );
    } else if (experienceFilter === "visited_by_others") {
      result = result.filter((p) => p.experienceStatus === "visited_by_others");
    } else if (experienceFilter === "untried") {
      result = result.filter((p) => p.experienceStatus === "untried");
    }

    // 5. Filtro por Radio en Km
    if (userLocation && radiusKm && radiusKm > 0) {
      const radiusMeters = radiusKm * 1000;
      result = result.filter(
        (p) => p.distanceMeters != null && p.distanceMeters <= radiusMeters
      );
    }

    // Ordenar: si hay ubicación, por cercanía; si no, mantener orden original
    if (userLocation) {
      result.sort((a, b) => {
        if (a.distanceMeters == null) return 1;
        if (b.distanceMeters == null) return -1;
        return a.distanceMeters - b.distanceMeters;
      });
    }

    return result;
  }, [
    initialPlaces,
    textSearch,
    selectedOccasions,
    selectedTags,
    selectedPrices,
    experienceFilter,
    userLocation,
    radiusKm,
  ]);

  // Manejar clic en "Ver en mapa" desde una tarjeta
  function handleSelectOnMap(placeId: string) {
    setSelectedPlaceId(placeId);
    setActiveMobileView("map");
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.scrollTo({ top: 180, behavior: "smooth" });
    }
  }

  // Categorías ordenadas por frecuencia de locales asociados (las más usadas primero)
  const sortedOccasions = useMemo(() => {
    return [...occasionsList].sort(
      (a, b) => (b.placesCount || 0) - (a.placesCount || 0) || a.name.localeCompare(b.name)
    );
  }, [occasionsList]);

  // Filtrado de categorías por texto de búsqueda
  const filteredOccasions = useMemo(() => {
    const q = occasionSearchQuery.toLowerCase().trim();
    if (!q) return sortedOccasions;
    return sortedOccasions.filter(
      (occ) => occ.name.toLowerCase().includes(q) || occ.id.toLowerCase().includes(q)
    );
  }, [sortedOccasions, occasionSearchQuery]);

  // Etiquetas ordenadas por frecuencia de uso (las más usadas primero)
  const sortedTags = useMemo(() => {
    return [...tagsList].sort(
      (a, b) => (b.placesCount || 0) - (a.placesCount || 0) || a.name.localeCompare(b.name)
    );
  }, [tagsList]);

  // Filtrado de etiquetas por texto de búsqueda
  const filteredTags = useMemo(() => {
    const q = tagSearchQuery.toLowerCase().trim();
    if (!q) return sortedTags;
    return sortedTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [sortedTags, tagSearchQuery]);

  // Etiquetas mostradas por defecto (las más usadas, priorizando las que tienen locales)
  const defaultTags = useMemo(() => {
    const top = sortedTags.filter((t) => (t.placesCount || 0) > 0).slice(0, 18);
    // Asegurar que las etiquetas actualmente seleccionadas estén siempre visibles al principio
    selectedTags.forEach((st) => {
      if (!top.some((t) => t.id === st)) {
        const current = sortedTags.find((t) => t.id === st);
        if (current) top.unshift(current);
      }
    });
    return top.length > 0 ? top : sortedTags.slice(0, 14);
  }, [sortedTags, selectedTags]);

  const activeFiltersCount =
    selectedOccasions.length +
    selectedTags.length +
    selectedPrices.length +
    (experienceFilter !== "all" ? 1 : 0) +
    (userLocation ? 1 : 0) +
    (textSearch.trim() ? 1 : 0);

  return (
    <div className="w-full space-y-4">
      {/* =========================================================================
          HERO ACTION HUB: Búsqueda interactiva y botones de acción rápida
         ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/95 dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-900/40 border border-slate-200 dark:border-slate-800 shadow-lg dark:shadow-xl backdrop-blur-md space-y-3.5 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Buscador de texto en vivo */}
          <div className="relative flex-1">
            <input
              type="text"
              value={textSearch}
              onChange={(e) => setTextSearch(e.target.value)}
              placeholder="🔍 Buscar restaurante, plato, ciudad (Roma, Tokio, Granada...)"
              className="w-full px-4 py-3 pl-10 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition shadow-inner"
            />
            <span className="absolute left-3.5 top-3.5 text-slate-400 dark:text-slate-500 text-sm pointer-events-none">
              🔎
            </span>
            {textSearch && (
              <button
                type="button"
                onClick={() => setTextSearch("")}
                className="absolute right-3.5 top-3.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Botón principal de Alta Rápida */}
          <a
            href="/new"
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition active:scale-[0.98] shrink-0"
          >
            <span className="text-base">➕</span>
            <span>Añadir sitio</span>
          </a>
        </div>

        {/* Barra de herramientas y filtros rápidos */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Toggle de vista en móvil */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 lg:hidden">
              <button
                type="button"
                onClick={() => setActiveMobileView("map")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeMobileView === "map"
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <span>🗺️ Mapa</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMobileView("list")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeMobileView === "list"
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <span>📋 Lista ({filteredPlaces.length})</span>
              </button>
            </div>

            {/* Botón Asistente Guiado */}
            <button
              type="button"
              onClick={() => setIsAssistantOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition cursor-pointer"
            >
              <span>🎯</span>
              <span>Asistente</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] flex items-center justify-center font-black">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Botón Selector Aleatorio «🎲 Elegir al azar» */}
            <button
              type="button"
              onClick={() => setIsRandomModalOpen(true)}
              disabled={filteredPlaces.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer disabled:opacity-40"
              title="Elegir al azar entre los resultados actuales"
            >
              <span>🎲</span>
              <span>Ruleta</span>
            </button>
          </div>

          {/* Lado derecho: Cerca de mí y botón limpiar */}
          <div className="flex items-center gap-2">
            {!userLocation ? (
              <button
                type="button"
                onClick={handleRequestLocation}
                disabled={isLocating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-900/60 bg-blue-950/40 hover:bg-blue-900/40 text-blue-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <span>{isLocating ? "⏳" : "📍"}</span>
                <span>{isLocating ? "Localizando..." : "Cerca de mí"}</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span>Ubicación activa</span>
                <button
                  type="button"
                  onClick={handleDisableLocation}
                  className="ml-1 text-slate-400 hover:text-red-400 cursor-pointer font-bold text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs text-slate-400 hover:text-red-400 underline cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {locationError && (
        <div className="p-3 rounded-2xl bg-red-950/40 border border-red-900/50 text-red-400 text-xs flex items-center justify-between">
          <span>⚠️ {locationError}</span>
          <button
            onClick={() => setLocationError(null)}
            className="text-xs font-bold text-red-400 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Selector de Radio si Cerca de mí está activo */}
      {userLocation && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-[11px] font-bold text-slate-400 shrink-0">Radio:</span>
          {[
            { label: "Todo", val: null },
            { label: "1 km", val: 1 },
            { label: "2 km", val: 2 },
            { label: "5 km", val: 5 },
            { label: "10 km", val: 10 },
            { label: "25 km", val: 25 },
          ].map((r) => {
            const isSelected = radiusKm === r.val;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => setRadiusKm(r.val)}
                className={`px-2.5 py-1 rounded-xl font-semibold shrink-0 transition cursor-pointer text-xs ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-900/60 border border-slate-800 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Píldoras Rápidas de Colección y Experiencia */}
      <HorizontalScroll className="flex items-center gap-1.5 pb-1 text-xs">
        {[
          { key: "all", label: "Todos", icon: "🌐" },
          { key: "favorite", label: "Favoritos", icon: "⭐" },
          { key: "pending", label: "Quiero ir", icon: "🕒" },
          { key: "visited_by_me", label: "Ya he ido", icon: "✅" },
          { key: "visited_by_others", label: "De amigos", icon: "👥" },
          { key: "untried", label: "Sin estrenar", icon: "✨" },
        ].map((item) => {
          const active = experienceFilter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                setExperienceFilter(
                  active && item.key !== "all" ? "all" : (item.key as typeof experienceFilter)
                )
              }
              className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer text-xs ${
                active
                  ? "bg-slate-900 text-slate-100 dark:bg-slate-100 dark:text-slate-950 shadow-md"
                  : "bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0 mx-1"></div>

        {/* Filtro rápido de precio (acumulable) */}
        {["€", "€€", "€€€", "€€€€"].map((p) => {
          const active = selectedPrices.includes(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => togglePrice(p)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer border ${
                active
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {p}
            </button>
          );
        })}
      </HorizontalScroll>

      {/* Filtros por Planes / Ocasiones (acumulables, con buscador y conmutador entre fila y cuadrícula) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] px-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400 uppercase tracking-wider">
              Planes / Categorías ({occasionsList.length})
            </span>
            {selectedOccasions.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedOccasions([])}
                className="text-red-400 hover:underline font-bold cursor-pointer"
              >
                ✕ Quitar {selectedOccasions.length === 1 ? "filtro" : `filtros (${selectedOccasions.length})`}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {occasionsList.length > 4 && (
              <button
                type="button"
                onClick={() => setIsOccasionSearchOpen(!isOccasionSearchOpen)}
                className={`font-semibold transition cursor-pointer flex items-center gap-1 ${
                  isOccasionSearchOpen || occasionSearchQuery ? "text-amber-400" : "text-slate-400 hover:text-slate-200"
                }`}
                title="Buscar categorías"
              >
                <span>🔍</span>
                <span className="hidden sm:inline">Buscar</span>
              </button>
            )}

            {occasionsList.length > 4 && (
              <button
                type="button"
                onClick={() => setIsOccasionsWrapped(!isOccasionsWrapped)}
                className="font-semibold text-amber-400 hover:text-amber-300 transition cursor-pointer flex items-center gap-1"
              >
                <span>{isOccasionsWrapped ? "↔ Modo fila" : "⊞ Cuadrícula"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Buscador de categorías si está abierto */}
        {isOccasionSearchOpen && (
          <div className="relative animate-in fade-in duration-150">
            <span className="absolute left-3 top-2 text-xs text-slate-500">🔍</span>
            <input
              type="text"
              value={occasionSearchQuery}
              onChange={(e) => setOccasionSearchQuery(e.target.value)}
              placeholder="Buscar categoría o plan (ej. tapear, brunch, terraza...)"
              className="w-full pl-8 pr-8 py-1.5 rounded-xl text-xs bg-slate-900 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {occasionSearchQuery && (
              <button
                type="button"
                onClick={() => setOccasionSearchQuery("")}
                className="absolute right-2.5 top-2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {isOccasionsWrapped ? (
          <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-2xl bg-slate-900/60 border border-slate-800 animate-in fade-in duration-150">
            <button
              type="button"
              onClick={() => setSelectedOccasions([])}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedOccasions.length === 0
                  ? "bg-amber-500 text-slate-950 shadow-md font-black"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800"
              }`}
            >
              🍽️ Todos los planes
            </button>
            {filteredOccasions.map((occ) => {
              const isSelected = selectedOccasions.includes(occ.id);
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => toggleOccasion(occ.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-amber-500 text-slate-950 shadow-md font-black ring-2 ring-amber-400/50"
                      : "bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span>{occ.icon}</span>
                  <span>{occ.name}</span>
                  {(occ.placesCount || 0) > 0 && (
                    <span className="text-[10px] opacity-60 ml-0.5">({occ.placesCount})</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <HorizontalScroll className="flex items-center gap-1.5 pb-1">
            <button
              type="button"
              onClick={() => setSelectedOccasions([])}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition cursor-pointer ${
                selectedOccasions.length === 0
                  ? "bg-amber-500 text-slate-950 shadow-md font-black"
                  : "bg-slate-900/80 border border-slate-800 text-slate-400 hover:bg-slate-800"
              }`}
            >
              🍽️ Todos los planes
            </button>
            {filteredOccasions.map((occ) => {
              const isSelected = selectedOccasions.includes(occ.id);
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => toggleOccasion(occ.id)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-amber-500 text-slate-950 shadow-md font-black ring-2 ring-amber-400/50"
                      : "bg-slate-900/80 border border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span>{occ.icon}</span>
                  <span>{occ.name}</span>
                  {(occ.placesCount || 0) > 0 && (
                    <span className="text-[10px] opacity-60 ml-0.5">({occ.placesCount})</span>
                  )}
                </button>
              );
            })}
          </HorizontalScroll>
        )}
      </div>

      {/* Filtro por Etiquetas Populares (acumulables, ordenadas por uso, con vista expandible y buscador) */}
      {sortedTags.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] px-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-400 uppercase tracking-wider">
                Etiquetas ({sortedTags.length})
              </span>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="text-red-400 hover:underline font-bold cursor-pointer"
                >
                  ✕ Quitar {selectedTags.length === 1 ? "filtro" : `filtros (${selectedTags.length})`}
                </button>
              )}
            </div>

            {sortedTags.length > 10 && (
              <button
                type="button"
                onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                className="font-semibold text-slate-400 hover:text-amber-400 transition cursor-pointer"
              >
                {isTagsExpanded ? "▲ Menos tags" : `+ Ver todos los ${sortedTags.length} tags`}
              </button>
            )}
          </div>

          {isTagsExpanded ? (
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 animate-in fade-in duration-150">
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-slate-500">🔍</span>
                <input
                  type="text"
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  placeholder="Filtrar etiquetas..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                {tagSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTagSearchQuery("")}
                    className="absolute right-2.5 top-2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1 max-h-44 overflow-y-auto pr-1 no-scrollbar">
                {filteredTags.map((t) => {
                  const isSelected = selectedTags.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer border ${
                        isSelected
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold ring-1 ring-amber-400/40"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                      }`}
                    >
                      #{t.name}
                      {t.placesCount > 0 && (
                        <span className="ml-1 opacity-60 text-[10px]">({t.placesCount})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <HorizontalScroll className="flex items-center gap-1 pb-1 text-xs">
              {defaultTags.map((t) => {
                const isSelected = selectedTags.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium shrink-0 transition cursor-pointer border ${
                      isSelected
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold ring-1 ring-amber-400/40"
                        : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                    }`}
                  >
                    <span>#{t.name}</span>
                    {t.placesCount > 0 && (
                      <span className="ml-1 text-[10px] opacity-60">({t.placesCount})</span>
                    )}
                  </button>
                );
              })}
            </HorizontalScroll>
          )}
        </div>
      )}

      {/* =========================================================================
          LAYOUT RESPONSIVE SPLIT-VIEW (Desktop 2 columnas, Móvil toggle)
         ========================================================================= */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start pt-2">
        {/* Columna Izquierda: Lista de Tarjetas */}
        <div
          className={`space-y-3.5 lg:col-span-5 xl:col-span-5 ${
            activeMobileView === "map" ? "hidden lg:block" : "block"
          }`}
        >
          {filteredPlaces.length === 0 ? (
            <div className="p-10 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 backdrop-blur-xs">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-base font-bold text-slate-200 mb-1">
                No encontramos ningún establecimiento
              </h3>
              <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
                Prueba a ajustar tu búsqueda, ampliar el radio de distancia o limpiar los filtros.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
              >
                Restablecer todos los filtros
              </button>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1 no-scrollbar">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                <span>{filteredPlaces.length} {filteredPlaces.length === 1 ? "sitio encontrado" : "sitios encontrados"}</span>
                {textSearch && <span>Buscando: «{textSearch}»</span>}
              </div>
              {filteredPlaces.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  occasionMap={occasionMap}
                  onSelectOnMap={() => handleSelectOnMap(place.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Columna Derecha: Mapa Interactivo Leaflet */}
        <div
          className={`lg:col-span-7 xl:col-span-7 ${
            activeMobileView === "list" ? "hidden lg:block" : "block"
          }`}
        >
          <div className="lg:sticky lg:top-4 space-y-2">
            <div className="rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
              <MapContainerWrapper
                places={filteredPlaces}
                selectedPlaceId={selectedPlaceId}
                onSelectPlace={(id) => setSelectedPlaceId(id)}
                userLocation={userLocation}
                radiusKm={radiusKm}
                occasionMap={occasionMap}
                cartoApiKey={cartoApiKey}
                className="w-full h-[65vh] sm:h-[540px] lg:h-[calc(100vh-14rem)] min-h-[440px]"
              />
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              Mostrando {filteredPlaces.filter((p) => p.latitude != null).length} locales geolocalizados en el mapa interactivo.
            </p>
          </div>
        </div>
      </div>

      {/* Modales Interactivos */}
      <RandomPickerModal
        isOpen={isRandomModalOpen}
        onClose={() => setIsRandomModalOpen(false)}
        places={filteredPlaces}
        onSelectOnMap={(id) => handleSelectOnMap(id)}
      />

      <DecisionAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        occasions={occasionsList}
        selectedOccasions={selectedOccasions}
        onSelectOccasions={(occs) => setSelectedOccasions(occs)}
        selectedPrice={selectedPrices[0] || null}
        onSelectPrice={(p) => setSelectedPrices(p ? [p] : [])}
        experienceFilter={experienceFilter}
        onSelectExperience={(exp) => setExperienceFilter(exp)}
        nearMeActive={userLocation !== null}
        onToggleNearMe={() => {
          if (userLocation) handleDisableLocation();
          else handleRequestLocation();
        }}
        radiusKm={radiusKm || 10}
        onChangeRadius={(km) => setRadiusKm(km)}
        onReset={resetAllFilters}
      />
    </div>
  );
}
