"use client";

import { useState, useMemo, useEffect } from "react";
import { PlaceCard } from "./PlaceCard";
import { MapContainerWrapper } from "@/components/map/MapContainerWrapper";
import { RandomPickerModal } from "./RandomPickerModal";
import { DecisionAssistantModal } from "./DecisionAssistantModal";
import { ExportImportModal } from "./ExportImportModal";
import { ComparePlacesModal } from "./ComparePlacesModal";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { useT } from "@/lib/i18n/client";
import type { PlaceWithDetails } from "@/lib/actions/places";
import {
  createSavedFilterAction,
  deleteSavedFilterAction,
  type SavedFilterItem,
} from "@/lib/actions/saved-filters";
import { getMyGroupsAction } from "@/lib/actions/groups";
import { parseCityCountry } from "@/lib/location";

interface PlacesExplorerProps {
  initialPlaces: PlaceWithDetails[];
  occasionsList: Array<{ id: string; name: string; icon: string; placesCount?: number }>;
  tagsList: { id: string; name: string; placesCount: number }[];
  currentUserId: string;
  isAdmin: boolean;
  occasionMap: Record<string, { name: string; icon: string }>;
  cartoApiKey?: string | null;
  initialSavedFilters?: SavedFilterItem[];
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
  initialSavedFilters = [],
}: PlacesExplorerProps) {
  const { t } = useT();
  // En móvil: alternar entre vista lista o mapa. En desktop: ambas se muestran simultáneamente.
  const [activeMobileView, setActiveMobileView] = useState<"list" | "map">("map");
  // Filtros acumulables
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [textSearch, setTextSearch] = useState<string>("");

  // Grupos privados
  const [myGroups, setMyGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGroupFilterIds, setSelectedGroupFilterIds] = useState<string[]>([]);
  const [isGroupFilterOpen, setIsGroupFilterOpen] = useState(false);

  // Paginación en modo lista
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Asistente y filtros avanzados (Fase 4)
  const [isRandomModalOpen, setIsRandomModalOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [experienceFilter, setExperienceFilter] = useState<
    "all" | "visited_by_me" | "visited_by_others" | "untried" | "favorite" | "pending"
  >("all");

  // Registro PWA Service Worker y caché offline de favoritos / pendientes
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Guardar favoritos y pendientes en caché local para consulta sin cobertura
    try {
      const offlineCollection = initialPlaces.filter(
        (p) => p.isFavorite || p.personalStatus === "pending"
      );
      localStorage.setItem(
        "gastromap_offline_collection_v1",
        JSON.stringify({
          updatedAt: new Date().toISOString(),
          places: offlineCollection,
        })
      );
    } catch {
      // Ignorar si localStorage no está disponible
    }

    const updateOnlineStatus = () => setIsOffline(!navigator.onLine);
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, [initialPlaces]);

  // Cargar grupos privados del usuario para el filtro rápido
  useEffect(() => {
    getMyGroupsAction()
      .then((list) => setMyGroups(list.map((g) => ({ id: g.id, name: g.name }))))
      .catch(() => {});
  }, []);

  function toggleComparePlace(placeId: string) {
    setCompareIds((prev) => {
      if (prev.includes(placeId)) return prev.filter((id) => id !== placeId);
      if (prev.length >= 3) return [...prev.slice(1), placeId];
      return [...prev, placeId];
    });
  }

  // Geolocalización
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);

  // Ordenación de resultados
  const [sortBy, setSortBy] = useState<
    "recent" | "distance" | "name" | "price_asc" | "price_desc" | "rating"
  >("recent");

  // Estados de vista adaptativa para evitar problemas de espacio con muchas categorías o tags
  const [isOccasionsWrapped, setIsOccasionsWrapped] = useState(false);
  const [isOccasionSearchOpen, setIsOccasionSearchOpen] = useState(false);
  const [occasionSearchQuery, setOccasionSearchQuery] = useState("");
  const [visibleOccasionsCount, setVisibleOccasionsCount] = useState(12);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [visibleTagsCount, setVisibleTagsCount] = useState(24);

  // Filtros guardados personales
  const [savedFilters, setSavedFilters] = useState<SavedFilterItem[]>(initialSavedFilters);
  const [isSaveFilterOpen, setIsSaveFilterOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");
  const [savingFilter, setSavingFilter] = useState(false);

  async function handleSaveCurrentFilter(e: React.FormEvent) {
    e.preventDefault();
    if (!newFilterName.trim() || savingFilter) return;
    setSavingFilter(true);
    const res = await createSavedFilterAction(newFilterName, {
      textSearch: textSearch.trim() || undefined,
      selectedOccasions,
      selectedTags,
      selectedPrices,
      experienceFilter,
      radiusKm,
      sortBy,
    });
    setSavingFilter(false);
    if (res.success && res.filter) {
      setSavedFilters((prev) => [res.filter!, ...prev]);
      setNewFilterName("");
      setIsSaveFilterOpen(false);
    }
  }

  function handleApplySavedFilter(item: SavedFilterItem) {
    const c = item.criteria || {};
    setTextSearch(c.textSearch || "");
    setSelectedOccasions(c.selectedOccasions || []);
    setSelectedTags(c.selectedTags || []);
    setSelectedPrices(c.selectedPrices || []);
    setExperienceFilter(c.experienceFilter || "all");
    if (c.sortBy) setSortBy(c.sortBy);
    if (c.radiusKm) {
      setRadiusKm(c.radiusKm);
      if (!userLocation) handleRequestLocation();
    } else {
      setRadiusKm(null);
    }
  }

  async function handleDeleteSavedFilter(filterId: string) {
    const res = await deleteSavedFilterAction(filterId);
    if (res.success) {
      setSavedFilters((prev) => prev.filter((f) => f.id !== filterId));
    }
  }

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
        if (!radiusKm) setRadiusKm(10);
        setSortBy("distance");
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
    setSortBy((prev) => (prev === "distance" ? "recent" : prev));
  }

  function resetAllFilters() {
    setSelectedOccasions([]);
    setSelectedTags([]);
    setSelectedPrices([]);
    setSelectedCountry("all");
    setSelectedCity("all");
    setExperienceFilter("all");
    setTextSearch("");
    setUserLocation(null);
    setRadiusKm(null);
    setOccasionSearchQuery("");
    setTagSearchQuery("");
  }

  // Lista única de países y ciudades filtradas
  const { allCountries, availableCities } = useMemo(() => {
    const cSet = new Set<string>();
    initialPlaces.forEach((p) => {
      const parsed = parseCityCountry(p.city);
      if (parsed.country) cSet.add(parsed.country);
    });
    const countries = Array.from(cSet).sort((a, b) => a.localeCompare(b));

    const citySet = new Set<string>();
    initialPlaces.forEach((p) => {
      const parsed = parseCityCountry(p.city);
      if (selectedCountry === "all" || parsed.country === selectedCountry) {
        if (parsed.city) citySet.add(parsed.city);
      }
    });
    const cities = Array.from(citySet).sort((a, b) => a.localeCompare(b));

    return { allCountries: countries, availableCities: cities };
  }, [initialPlaces, selectedCountry]);

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

    // 6. Filtro por Grupos Privados (si se seleccionaron grupos específicos)
    if (selectedGroupFilterIds.length > 0) {
      result = result.filter(
        (p) =>
          p.sharedGroupIds &&
          p.sharedGroupIds.some((gid) => selectedGroupFilterIds.includes(gid))
      );
    }

    // 7. Filtro por País
    if (selectedCountry !== "all") {
      result = result.filter((p) => parseCityCountry(p.city).country === selectedCountry);
    }

    // 8. Filtro por Ciudad
    if (selectedCity !== "all") {
      result = result.filter((p) => parseCityCountry(p.city).city === selectedCity);
    }

    // Ordenación configurable por el usuario
    const priceOrder: Record<string, number> = {
      "€": 1,
      "€€": 2,
      "€€€": 3,
      "€€€€": 4,
      "???": 99,
    };

    if (sortBy === "distance" && userLocation) {
      result.sort((a, b) => {
        if (a.distanceMeters == null) return 1;
        if (b.distanceMeters == null) return -1;
        return a.distanceMeters - b.distanceMeters;
      });
    } else if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name, "es"));
    } else if (sortBy === "price_asc") {
      result.sort((a, b) => (priceOrder[a.priceRange] ?? 99) - (priceOrder[b.priceRange] ?? 99));
    } else if (sortBy === "price_desc") {
      result.sort((a, b) => {
        const pa = a.priceRange === "???" ? -1 : (priceOrder[a.priceRange] ?? -1);
        const pb = b.priceRange === "???" ? -1 : (priceOrder[b.priceRange] ?? -1);
        return pb - pa;
      });
    } else if (sortBy === "rating") {
      result.sort((a, b) => {
        const ra = a.rating ?? -1;
        const rb = b.rating ?? -1;
        if (rb !== ra) return rb - ra;
        return a.name.localeCompare(b.name, "es");
      });
    } else {
      // 'recent': más recientes primero
      result.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return result;
  }, [
    initialPlaces,
    textSearch,
    selectedOccasions,
    selectedTags,
    selectedPrices,
    selectedCountry,
    selectedCity,
    selectedGroupFilterIds,
    experienceFilter,
    userLocation,
    radiusKm,
    sortBy,
  ]);

  // Al cambiar filtros, resetear a la primera página
  useEffect(() => {
    setCurrentPage(1);
  }, [
    textSearch,
    selectedOccasions,
    selectedTags,
    selectedPrices,
    selectedCountry,
    selectedCity,
    selectedGroupFilterIds,
    experienceFilter,
    radiusKm,
    sortBy,
  ]);

  // Cálculo de locales paginados
  const totalPages = Math.max(1, Math.ceil(filteredPlaces.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedPlaces = useMemo(() => {
    return filteredPlaces.slice(startIndex, startIndex + pageSize);
  }, [filteredPlaces, startIndex, pageSize]);

  const selectedPlace = useMemo(
    () => (selectedPlaceId ? filteredPlaces.find((p) => p.id === selectedPlaceId) || null : null),
    [filteredPlaces, selectedPlaceId]
  );

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    if (typeof window !== "undefined") {
      const el = document.getElementById("places-list-top");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

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
    (selectedCountry !== "all" ? 1 : 0) +
    (selectedCity !== "all" ? 1 : 0) +
    (experienceFilter !== "all" ? 1 : 0) +
    (userLocation ? 1 : 0) +
    (textSearch.trim() ? 1 : 0);

  return (
    <div className="w-full space-y-4">
      {/* Banner discreto en modo sin conexión (PWA offline) */}
      {isOffline && (
        <div className="px-4 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center justify-between gap-2">
          <span>📡 Modo sin conexión — Consultando datos en caché offline</span>
          <span className="text-[11px] opacity-75">Solo lectura</span>
        </div>
      )}

      {/* =========================================================================
          HERO ACTION HUB: Búsqueda interactiva y botones de acción rápida
         ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-md dark:border-slate-800 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/90 dark:to-slate-900/40 dark:shadow-xl backdrop-blur-md space-y-3.5 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Buscador de texto en vivo */}
          <div className="relative flex-1">
            <input
              type="text"
              value={textSearch}
              onChange={(e) => setTextSearch(e.target.value)}
              placeholder={t("places.search_placeholder")}
              className="w-full px-4 py-3 pl-10 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 dark:focus:ring-amber-500/50 focus:border-amber-500 transition shadow-inner"
            />
            <span className="absolute left-3.5 top-3.5 text-slate-400 dark:text-slate-500 text-sm pointer-events-none">
              🔍
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
            <span>{t("places.add_new")}</span>
          </a>
        </div>

        {/* Barra de herramientas y filtros rápidos */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón Asistente Guiado */}
            <button
              type="button"
              onClick={() => setIsAssistantOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition cursor-pointer"
            >
              <span>🎯</span>
              <span>{t("places.assistant")}</span>
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
              <span>{t("places.roulette")}</span>
            </button>

            {/* Botón Importar / Exportar */}
            <button
              type="button"
              onClick={() => setIsExportImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              title="Exportar o importar establecimientos (JSON, CSV, GeoJSON, KML, Google Takeout)"
            >
              <span>📦</span>
              <span className="hidden sm:inline">{t("places.export_import")}</span>
            </button>
          </div>

          {/* Lado derecho: Cerca de mí y botón limpiar */}
          <div className="flex items-center gap-2">
            {!userLocation ? (
              <button
                type="button"
                onClick={handleRequestLocation}
                disabled={isLocating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                <span>{isLocating ? "⏳" : "📍"}</span>
                <span>{isLocating ? "Localizando..." : t("places.near_me")}</span>
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
              <>
                <button
                  type="button"
                  onClick={() => setIsSaveFilterOpen((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition cursor-pointer"
                  title="Guardar esta combinación de filtros"
                >
                  <span>💾</span>
                  <span className="hidden sm:inline">Guardar filtro</span>
                </button>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-xs text-slate-400 hover:text-red-400 underline cursor-pointer"
                >
                  Limpiar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mini formulario para guardar combinación actual de filtros */}
        {isSaveFilterOpen && (
          <form
            onSubmit={handleSaveCurrentFilter}
            className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 animate-in fade-in duration-150"
          >
            <input
              type="text"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              placeholder="Ej. Tapear sin estrenar, Citas baratas..."
              autoFocus
              className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={savingFilter || newFilterName.trim().length < 2}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition cursor-pointer disabled:opacity-40 shrink-0"
            >
              {savingFilter ? "..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setIsSaveFilterOpen(false)}
              className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              ✕
            </button>
          </form>
        )}

        {/* Barra de filtros guardados del usuario */}
        {savedFilters.length > 0 && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 shrink-0">🔖 Mis filtros:</span>
            {savedFilters.map((sf) => (
              <div
                key={sf.id}
                className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 text-[11px] shrink-0 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleApplySavedFilter(sf)}
                  className="px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
                  title="Aplicar filtro guardado"
                >
                  {sf.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSavedFilter(sf.id)}
                  className="pr-2 pl-0.5 py-1 text-slate-400 hover:text-red-500 transition cursor-pointer text-[10px]"
                  title="Eliminar filtro guardado"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
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
          { key: "all", label: t("places.all"), icon: "🌐" },
          { key: "favorite", label: t("places.favorites"), icon: "⭐" },
          { key: "pending", label: t("places.want_to_go"), icon: "🕒" },
          { key: "visited_by_me", label: t("places.visited"), icon: "✅" },
          { key: "visited_by_others", label: t("places.friends"), icon: "👥" },
          { key: "untried", label: t("places.unexplored"), icon: "✨" },
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
      </HorizontalScroll>

      {/* Filtros Específicos: Grupos Privados y Rangos de Precio (En líneas distintas en móvil para mayor claridad) */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-1 text-xs">
        {/* Línea 1: Filtro por Grupos Privados (si el usuario tiene grupos) */}
        {myGroups.length > 0 && (
          <div className="relative shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGroupFilterOpen((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer text-xs border ${
                selectedGroupFilterIds.length > 0
                  ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <span>👥</span>
              <span>
                {selectedGroupFilterIds.length === 0
                  ? t("places.groups_filter")
                  : selectedGroupFilterIds.length === 1
                  ? myGroups.find((g) => g.id === selectedGroupFilterIds[0])?.name || t("places.group_count_single")
                  : t("places.group_count_multiple", { count: selectedGroupFilterIds.length })}
              </span>
              <span className="text-[10px]">{isGroupFilterOpen ? "▲" : "▼"}</span>
            </button>

            {/* Popover desplegable visual de grupos privados */}
            {isGroupFilterOpen && (
              <div className="absolute top-full left-0 mt-2 z-50 w-72 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 space-y-2 text-left animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {t("places.filter_by_group")}
                  </span>
                  {selectedGroupFilterIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedGroupFilterIds([])}
                      className="text-[10px] text-amber-500 font-semibold hover:underline cursor-pointer"
                    >
                      {t("places.clear_filter")}
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {myGroups.map((g) => {
                    const isSelected = selectedGroupFilterIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGroupFilterIds((prev) =>
                            prev.includes(g.id)
                              ? prev.filter((id) => id !== g.id)
                              : [...prev, g.id]
                          );
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 text-white font-bold"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span className="truncate">👥 {g.name}</span>
                        {isSelected && <span className="text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0 mx-0.5"></div>
          </div>
        )}

        {/* Línea 2: Filtro rápido de precio numérico (acumulable en su propia línea o continuación en desktop) */}
        <HorizontalScroll className="flex items-center gap-1.5 text-xs">
          {/* Filtros de País y Ciudad */}
          {allCountries.length > 0 && (
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                setSelectedCity("all");
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-xs shrink-0"
            >
              <option value="all">🌍 {t("places.all_countries")} ({allCountries.length})</option>
              {allCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {availableCities.length > 0 && (
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-xs shrink-0"
            >
              <option value="all">🏙️ {t("places.all_cities")} ({availableCities.length})</option>
              {availableCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0 mx-0.5"></div>

          {[
            { id: "€", label: "< 15 €" },
            { id: "€€", label: "15 - 30 €" },
            { id: "€€€", label: "30 - 50 €" },
            { id: "€€€€", label: "> 50 €" },
          ].map((item) => {
            const active = selectedPrices.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => togglePrice(item.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer border ${
                  active
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </HorizontalScroll>
      </div>

      {/* Filtros por Planes / Ocasiones (acumulables, con buscador y conmutador entre fila y cuadrícula) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] px-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400 uppercase tracking-wider">
              {t("places.plans_title")} ({occasionsList.length})
            </span>
            {selectedOccasions.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedOccasions([])}
                className="text-red-400 hover:underline font-bold cursor-pointer"
              >
                {selectedOccasions.length === 1
                  ? t("places.remove_filter_single")
                  : t("places.remove_filter_multiple", { count: selectedOccasions.length })}
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
                title={t("places.search_categories_title")}
              >
                <span>🔍</span>
                <span className="hidden sm:inline">{t("places.search_categories_btn")}</span>
              </button>
            )}

            {occasionsList.length > 4 && (
              <button
                type="button"
                onClick={() => setIsOccasionsWrapped(!isOccasionsWrapped)}
                className="font-semibold text-amber-400 hover:text-amber-300 transition cursor-pointer flex items-center gap-1"
              >
                <span>{isOccasionsWrapped ? t("places.row_mode") : t("places.grid_mode")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Buscador de categorías si está abierto */}
        {isOccasionSearchOpen && (
          <div className="relative animate-in fade-in duration-150">
            <span className="absolute left-3 top-2 text-xs text-slate-400 dark:text-slate-500">🔍</span>
            <input
              type="text"
              value={occasionSearchQuery}
              onChange={(e) => setOccasionSearchQuery(e.target.value)}
              placeholder={t("places.search_occasions_placeholder")}
              className="w-full pl-8 pr-8 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            {occasionSearchQuery && (
              <button
                type="button"
                onClick={() => setOccasionSearchQuery("")}
                className="absolute right-2.5 top-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {isOccasionsWrapped ? (
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedOccasions([])}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedOccasions.length === 0
                    ? "bg-amber-500 text-slate-950 shadow-md font-black"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                🍽️ {t("places.all_plans")}
              </button>
              {(occasionSearchQuery.trim()
                ? filteredOccasions
                : filteredOccasions.slice(0, visibleOccasionsCount)
              ).map((occ) => {
                const isSelected = selectedOccasions.includes(occ.id);
                return (
                  <button
                    key={occ.id}
                    type="button"
                    onClick={() => toggleOccasion(occ.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-amber-500 text-slate-950 shadow-md font-black ring-2 ring-amber-400/50"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
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

            {!occasionSearchQuery.trim() &&
              (filteredOccasions.length > visibleOccasionsCount ||
                visibleOccasionsCount > 12) && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  {filteredOccasions.length > visibleOccasionsCount ? (
                    <button
                      type="button"
                      onClick={() => setVisibleOccasionsCount((c) => c + 12)}
                      className="font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      {t("places.show_more_remaining", {
                        count: filteredOccasions.length - visibleOccasionsCount,
                      })}
                    </button>
                  ) : (
                    <span className="text-slate-400">{t("places.showing_all_categories")}</span>
                  )}
                  {visibleOccasionsCount > 12 && (
                    <button
                      type="button"
                      onClick={() => setVisibleOccasionsCount(12)}
                      className="font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {t("places.show_less")}
                    </button>
                  )}
                </div>
              )}
          </div>
        ) : (
          <HorizontalScroll className="flex items-center gap-1.5 pb-1">
            <button
              type="button"
              onClick={() => setSelectedOccasions([])}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition cursor-pointer ${
                selectedOccasions.length === 0
                  ? "bg-amber-500 text-slate-950 shadow-md font-black"
                  : "bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 shadow-xs dark:shadow-none"
              }`}
            >
              🍽️ {t("places.all_plans")}
            </button>
            {(occasionSearchQuery.trim()
              ? filteredOccasions
              : filteredOccasions.slice(0, visibleOccasionsCount)
            ).map((occ) => {
              const isSelected = selectedOccasions.includes(occ.id);
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => toggleOccasion(occ.id)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-amber-500 text-slate-950 shadow-md font-black ring-2 ring-amber-400/50"
                      : "bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 shadow-xs dark:shadow-none"
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
            {!occasionSearchQuery.trim() && filteredOccasions.length > visibleOccasionsCount && (
              <button
                type="button"
                onClick={() => setVisibleOccasionsCount((c) => c + 12)}
                className="px-3 py-2 rounded-2xl text-xs font-bold shrink-0 border border-dashed border-amber-400/70 dark:border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition cursor-pointer"
              >
                {t("places.show_more_count", {
                  count: filteredOccasions.length - visibleOccasionsCount,
                })}
              </button>
            )}
          </HorizontalScroll>
        )}
      </div>

      {/* Filtro por Etiquetas Populares (acumulables, ordenadas por uso, con buscador y Mostrar más) */}
      {sortedTags.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] px-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t("places.tags_title")} ({sortedTags.length})
              </span>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="text-red-500 hover:underline font-bold cursor-pointer"
                >
                  {selectedTags.length === 1
                    ? t("places.remove_filter_single")
                    : t("places.remove_filter_multiple", { count: selectedTags.length })}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                className="font-semibold text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer flex items-center gap-1"
              >
                <span>{isTagsExpanded ? t("places.hide_search") : t("places.search_show_more")}</span>
              </button>
            </div>
          </div>

          {isTagsExpanded ? (
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 animate-in fade-in duration-150">
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-slate-400 dark:text-slate-500">🔍</span>
                <input
                  type="text"
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  placeholder={t("places.search_tags_placeholder")}
                  className="w-full pl-8 pr-8 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                {tagSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTagSearchQuery("")}
                    className="absolute right-2.5 top-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {filteredTags.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-1">
                    {t("places.no_tags_found", { query: tagSearchQuery })}
                  </p>
                ) : (
                  (tagSearchQuery.trim()
                    ? filteredTags.slice(0, 40)
                    : filteredTags.slice(0, visibleTagsCount)
                  ).map((t) => {
                    const isSelected = selectedTags.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTag(t.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer border ${
                          isSelected
                            ? "bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/50 text-amber-900 dark:text-amber-300 font-bold ring-1 ring-amber-400/40 shadow-xs"
                            : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs dark:shadow-none"
                        }`}
                      >
                        #{t.name}
                        {t.placesCount > 0 && (
                          <span className="ml-1 opacity-60 text-[10px]">({t.placesCount})</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {!tagSearchQuery.trim() &&
                (filteredTags.length > visibleTagsCount || visibleTagsCount > 24) && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                    {filteredTags.length > visibleTagsCount ? (
                      <button
                        type="button"
                        onClick={() => setVisibleTagsCount((c) => c + 24)}
                        className="font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      >
                        {t("places.show_more_remaining", {
                          count: filteredTags.length - visibleTagsCount,
                        })}
                      </button>
                    ) : (
                      <span className="text-slate-400">{t("places.showing_all_tags")}</span>
                    )}
                    {visibleTagsCount > 24 && (
                      <button
                        type="button"
                        onClick={() => setVisibleTagsCount(24)}
                        className="font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {t("places.show_less")}
                      </button>
                    )}
                  </div>
                )}
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
                        ? "bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/50 text-amber-900 dark:text-amber-300 font-bold ring-1 ring-amber-400/40 shadow-xs"
                        : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs dark:shadow-none"
                    }`}
                  >
                    <span>#{t.name}</span>
                    {t.placesCount > 0 && (
                      <span className="ml-1 text-[10px] opacity-60">({t.placesCount})</span>
                    )}
                  </button>
                );
              })}
              {sortedTags.length > defaultTags.length && (
                <button
                  type="button"
                  onClick={() => setIsTagsExpanded(true)}
                  className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold shrink-0 border border-dashed border-amber-400/70 dark:border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition cursor-pointer"
                >
                  {t("places.show_more_count", {
                    count: sortedTags.length - defaultTags.length,
                  })}
                </button>
              )}
            </HorizontalScroll>
          )}
        </div>
      )}

      {/* =========================================================================
          SELECTOR DE VISTA MÓVIL PROMINENTE (Pegado directamente a Mapa / Lista)
         ========================================================================= */}
      <div className="lg:hidden pt-1">
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-200/80 dark:bg-slate-900 border border-slate-300/80 dark:border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveMobileView("map")}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMobileView === "map"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span className="text-base leading-none">🗺️</span>
            <span>{t("places.view_map")}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeMobileView === "map"
                  ? "bg-slate-950/15 text-slate-950"
                  : "bg-slate-300/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {filteredPlaces.filter((p) => p.latitude != null).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMobileView("list")}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMobileView === "list"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span className="text-base leading-none">📋</span>
            <span>{t("places.view_list")}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeMobileView === "list"
                  ? "bg-slate-950/15 text-slate-950"
                  : "bg-slate-300/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {filteredPlaces.length}
            </span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          LAYOUT RESPONSIVE SPLIT-VIEW (Desktop 2 columnas, Móvil toggle + scroll fluido)
         ========================================================================= */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start pt-1 lg:pt-2">
        {/* Columna Mapa: en móvil va arriba cuando activeMobileView === "map", o se oculta si activeMobileView === "list" */}
        <div
          className={`w-full lg:col-span-7 xl:col-span-7 lg:order-2 ${
            activeMobileView === "list" ? "hidden lg:block" : "block order-1 mb-4 lg:mb-0"
          }`}
        >
          <div className="lg:sticky lg:top-4 space-y-2 pb-2 lg:pb-0">
            <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl">
              <MapContainerWrapper
                places={filteredPlaces}
                selectedPlaceId={selectedPlaceId}
                onSelectPlace={(id) => setSelectedPlaceId(id)}
                userLocation={userLocation}
                radiusKm={radiusKm}
                occasionMap={occasionMap}
                cartoApiKey={cartoApiKey}
                className="w-full h-[50vh] sm:h-[500px] lg:h-[calc(100vh-14rem)] min-h-[360px]"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-2 flex-wrap gap-1">
              <span>
                {t("places.showing_geolocated", {
                  count: filteredPlaces.filter((p) => p.latitude != null).length,
                })}
              </span>
              <button
                type="button"
                onClick={() => {
                  document.getElementById("places-list-top")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="lg:hidden px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <span>{t("places.jump_to_list")} ({filteredPlaces.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Columna Lista de Tarjetas: en móvil va abajo cuando activeMobileView === "map", o primero si activeMobileView === "list" */}
        <div
          id="places-list-top"
          className="space-y-3.5 lg:col-span-5 xl:col-span-5 lg:order-1 order-2 w-full"
        >
          {filteredPlaces.length === 0 ? (
            <div className="p-10 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/70 dark:bg-slate-900/30 backdrop-blur-xs">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                {t("places.no_results")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs mx-auto">
                Prueba a ajustar tu búsqueda, ampliar el radio de distancia o limpiar los filtros.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer"
              >
                {t("places.reset_filters")}
              </button>
            </div>
          ) : (
            <div className="space-y-3.5 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1 no-scrollbar pb-14 lg:pb-0">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500 font-medium px-1 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {filteredPlaces.length} {filteredPlaces.length === 1 ? t("places.locale_single") : t("places.locales_count")}
                  </span>
                  {totalPages > 1 && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                      {t("places.page_of", { current: currentPage, total: totalPages })}
                    </span>
                  )}
                  {textSearch && <span className="hidden sm:inline text-slate-400">• «{textSearch}»</span>}
                </div>

                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="hidden sm:inline">{t("places.sort_by")}:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="px-2 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                    aria-label={t("places.sort_by")}
                  >
                    <option value="recent">🕒 {t("places.sort_recent")}</option>
                    {userLocation && <option value="distance">📍 {t("places.sort_distance")}</option>}
                    <option value="rating">⭐ {t("places.sort_rating")}</option>
                    <option value="name">🔤 {t("places.sort_alphabetical")}</option>
                    <option value="price_asc">💶 {t("places.sort_price_asc")}</option>
                    <option value="price_desc">💶 {t("places.sort_price_desc")}</option>
                  </select>
                </label>
              </div>

              {/* Tarjetas paginadas */}
              {paginatedPlaces.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  occasionMap={occasionMap}
                  occasionsList={occasionsList}
                  availableTags={tagsList.map((t) => t.name)}
                  onSelectOnMap={() => handleSelectOnMap(place.id)}
                  isCompared={compareIds.includes(place.id)}
                  onToggleCompare={() => toggleComparePlace(place.id)}
                />
              ))}

              {/* Barra de Paginación */}
              {totalPages > 1 && (
                <div className="pt-3 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Mostrando {startIndex + 1} - {Math.min(startIndex + pageSize, filteredPlaces.length)} de {filteredPlaces.length}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition text-xs"
                    >
                      {t("places.previous")}
                    </button>

                    <div className="flex items-center gap-1 mx-1">
                      {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalPages ||
                            Math.abs(p - currentPage) <= 1
                        )
                        .map((p, idx, arr) => {
                          const prev = arr[idx - 1];
                          const showEllipsis = prev && p - prev > 1;
                          return (
                            <span key={p} className="flex items-center gap-1">
                              {showEllipsis && (
                                <span className="text-slate-400 px-0.5 text-xs">…</span>
                              )}
                              <button
                                type="button"
                                onClick={() => handlePageChange(p)}
                                className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center transition cursor-pointer ${
                                  currentPage === p
                                    ? "bg-amber-500 text-slate-950 shadow-xs"
                                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                {p}
                              </button>
                            </span>
                          );
                        })}
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition text-xs"
                    >
                      {t("places.next")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fin layout */}
      </div>

      {/* Botón flotante rápido en móvil (estilo Airbnb / Google Maps) para alternar sin volver arriba */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 lg:hidden">
        <button
          type="button"
          onClick={() => {
            setActiveMobileView((prev) => (prev === "map" ? "list" : "map"));
          }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-slate-900/95 dark:bg-amber-500 text-white dark:text-slate-950 font-black text-xs shadow-2xl shadow-slate-950/50 dark:shadow-amber-500/30 border border-slate-700/70 dark:border-amber-300/60 backdrop-blur-md active:scale-95 transition cursor-pointer"
        >
          {activeMobileView === "map" ? (
            <>
              <span className="text-sm">📋</span>
              <span>Ver lista ({filteredPlaces.length})</span>
            </>
          ) : (
            <>
              <span className="text-sm">🗺️</span>
              <span>Ver mapa ({filteredPlaces.filter((p) => p.latitude != null).length})</span>
            </>
          )}
        </button>
      </div>

      {/* Barra flotante del Comparador de Establecimientos (hasta 3 sitios) */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-20 lg:bottom-5 left-1/2 -translate-x-1/2 z-40">
          <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900/95 dark:bg-slate-900 text-white border border-amber-500/40 shadow-2xl backdrop-blur-md">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <span>⚖️</span>
              <span>Comparar ({compareIds.length}/3)</span>
            </span>
            <button
              type="button"
              onClick={() => setIsCompareOpen(true)}
              disabled={compareIds.length < 2}
              className="px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Abrir
            </button>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs text-slate-400 hover:text-red-400 font-bold px-1 cursor-pointer"
              title="Limpiar comparación"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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

      <ExportImportModal
        isOpen={isExportImportOpen}
        onClose={() => setIsExportImportOpen(false)}
        places={filteredPlaces}
      />

      <ComparePlacesModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        places={initialPlaces.filter((p) => compareIds.includes(p.id))}
        occasionMap={occasionMap}
        onRemovePlace={(id) => toggleComparePlace(id)}
        onSelectOnMap={handleSelectOnMap}
      />

      {/* Opción 7: Tarjeta flotante inferior en móvil con sitio seleccionado en el mapa */}
      {selectedPlace && activeMobileView === "map" && (
        <div className="lg:hidden fixed bottom-4 left-3 right-3 z-40 p-4 rounded-3xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  {selectedPlace.priceRange}
                </span>
                {selectedPlace.isFavorite && <span className="text-xs">⭐</span>}
                <span className="text-xs font-bold text-slate-500 truncate">
                  {selectedPlace.city || ""}
                </span>
              </div>
              <h4 className="font-black text-slate-900 dark:text-slate-100 text-sm mt-1 truncate">
                {selectedPlace.name}
              </h4>
              {selectedPlace.address && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  📍 {selectedPlace.address}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedPlaceId(null)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              aria-label="Cerrar tarjeta flotante"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs">
            {selectedPlace.latitude != null && selectedPlace.longitude != null && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.latitude},${selectedPlace.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-center border border-blue-200 dark:border-blue-900/40"
              >
                🗺️ Cómo llegar
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveMobileView("list");
                setTimeout(() => {
                  document.getElementById(`place-card-${selectedPlace.id}`)?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-center shadow-sm cursor-pointer"
            >
              Ver ficha completa →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
