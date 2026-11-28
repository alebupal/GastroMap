"use client";

import { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { PlaceCard } from "./PlaceCard";
import type { CopyTargetSpaceOption } from "./CopyPlaceModal";
import { MapContainerWrapper } from "@/components/map/MapContainerWrapper";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { useT } from "@/lib/i18n/client";
import { normalizeSearchText } from "@/lib/search";
import { buildTasteProfile, scorePlaceByTaste, getTasteSummary } from "@/lib/taste";
import type { PlaceWithDetails, CommunityUserSummary } from "@/lib/actions/places";
import {
  createSavedFilterAction,
  deleteSavedFilterAction,
  type SavedFilterItem,
} from "@/lib/actions/saved-filters";
import { parseCityCountry, findCountry, resolveFilterCity } from "@/lib/location";
import { MultiSearchableSelect } from "@/components/ui/MultiSearchableSelect";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/CustomSelect";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { OfflineSyncBanner } from "@/components/pwa/OfflineSyncBanner";
import { OccasionIcon } from "@/components/ui/OccasionIcon";
import { MobileBottomNav, MOBILE_NAV_EVENTS } from "@/components/layout/MobileBottomNav";
import { MobileFilterBar } from "./MobileFilterBar";
import { useToast } from "@/components/ui/Toast";
import { copyText } from "@/lib/clipboard";

const RandomPickerModal = dynamic(() =>
  import("./RandomPickerModal").then((m) => m.RandomPickerModal)
);
const DecisionAssistantModal = dynamic(() =>
  import("./DecisionAssistantModal").then((m) => m.DecisionAssistantModal)
);
const ExportImportModal = dynamic(() =>
  import("./ExportImportModal").then((m) => m.ExportImportModal)
);
const ComparePlacesModal = dynamic(() =>
  import("./ComparePlacesModal").then((m) => m.ComparePlacesModal)
);
const CommandPalette = dynamic(() =>
  import("@/components/ui/CommandPalette").then((m) => m.CommandPalette)
);
const BulkAddToListModal = dynamic(() =>
  import("./BulkAddToListModal").then((m) => m.BulkAddToListModal)
);

interface PlacesExplorerProps {
  initialPlaces: PlaceWithDetails[];
  occasionsList: Array<{ id: string; name: string; icon: string; placesCount?: number }>;
  tagsList: { id: string; name: string; placesCount: number }[];
  currentUserId: string;
  isAdmin: boolean;
  occasionMap: Record<string, { name: string; icon: string }>;
  initialSavedFilters?: SavedFilterItem[];
  communityUsers?: CommunityUserSummary[];
  workspaceMode?: "group" | "personal" | "all";
  isSpaceAdmin?: boolean;
  availableSpaces?: CopyTargetSpaceOption[];
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
  initialSavedFilters = [],
  communityUsers = [],
  workspaceMode = "group",
  isSpaceAdmin = false,
  availableSpaces = [],
}: PlacesExplorerProps) {
  const { t, locale } = useT();
  const { toast } = useToast();
  // Catálogo local sincronizado para reflejar micro-interacciones en 0 ms sin revalidatePath("/")
  const [placesData, setPlacesData] = useState<PlaceWithDetails[]>(initialPlaces);
  useEffect(() => {
    setPlacesData(initialPlaces);
  }, [initialPlaces]);

  // En móvil: alternar entre vista lista o mapa. En desktop: ambas se muestran simultáneamente.
  const [activeMobileView, setActiveMobileView] = useState<"list" | "map">("map");
  // Filtros acumulables
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [textSearch, setTextSearch] = useState<string>("");
  const deferredTextSearch = useDeferredValue(textSearch);
  const [showExtraFilters, setShowExtraFilters] = useState(false);

  const handlePersonalUpdate = useCallback(
    (
      placeId: string,
      patch: Partial<
        Pick<PlaceWithDetails, "isFavorite" | "personalStatus" | "rating" | "privateNotes">
      >
    ) => {
      setPlacesData((prev) =>
        prev.map((p) => {
          if (p.id !== placeId) return p;
          const nextFavorite = patch.isFavorite !== undefined ? patch.isFavorite : p.isFavorite;
          const nextStatus =
            patch.personalStatus !== undefined ? patch.personalStatus : p.personalStatus;
          const nextRating = patch.rating !== undefined ? patch.rating : p.rating;
          const nextPrivateNotes =
            patch.privateNotes !== undefined ? patch.privateNotes : p.privateNotes;

          const toggleUid = (arr: string[] | undefined, active: boolean) => {
            const base = arr || [];
            if (active) return base.includes(currentUserId) ? base : [...base, currentUserId];
            return base.filter((id) => id !== currentUserId);
          };

          const isVisitedByMe =
            nextStatus === "visited" || (nextRating !== null && (nextRating ?? 0) > 0);
          const nextVisitedIds = toggleUid(p.visitedUserIds, isVisitedByMe);
          const nextPendingIds = toggleUid(p.pendingUserIds, nextStatus === "pending");
          const nextFavoriteIds = toggleUid(p.favoriteUserIds, Boolean(nextFavorite));
          const nextHighRatedIds = toggleUid(
            p.highRatedUserIds,
            nextRating !== null && (nextRating ?? 0) >= 8
          );
          const nextExperienceStatus: PlaceWithDetails["experienceStatus"] = isVisitedByMe
            ? "visited_by_me"
            : nextVisitedIds.some((id) => id !== currentUserId)
              ? "visited_by_others"
              : "untried";

          return {
            ...p,
            isFavorite: nextFavorite,
            personalStatus: nextStatus,
            rating: nextRating,
            privateNotes: nextPrivateNotes,
            visitedUserIds: nextVisitedIds,
            pendingUserIds: nextPendingIds,
            favoriteUserIds: nextFavoriteIds,
            highRatedUserIds: nextHighRatedIds,
            experienceStatus: nextExperienceStatus,
          };
        })
      );
    },
    [currentUserId]
  );

  // Filtro por espacio (solo aplicable en vista combinada «Todos mis sitios»)
  const [mounted, setMounted] = useState(false);
  const [selectedSpaceFilterIds, setSelectedSpaceFilterIds] = useState<string[]>([]);
  const [isSpaceFilterOpen, setIsSpaceFilterOpen] = useState(false);
  const groupBtnRef = useRef<HTMLButtonElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const [groupCoords, setGroupCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Posicionar menú emergente de espacios con coordenadas fijas (evita cortes de overflow-x)
  const updateGroupCoords = () => {
    if (groupBtnRef.current) {
      const rect = groupBtnRef.current.getBoundingClientRect();
      const popupWidth = window.innerWidth < 640 ? 256 : 288;
      let left = rect.left;
      if (left + popupWidth > window.innerWidth - 12) {
        left = window.innerWidth - popupWidth - 12;
      }
      if (left < 12) left = 12;

      const estimatedHeight = 260;
      let top = rect.bottom + 6;
      if (top + estimatedHeight > window.innerHeight - 12 && rect.top > estimatedHeight + 12) {
        top = rect.top - estimatedHeight - 6;
      }

      setGroupCoords({
        top,
        left,
      });
    }
  };

  useEffect(() => {
    if (!isSpaceFilterOpen) return;

    updateGroupCoords();
    window.addEventListener("scroll", updateGroupCoords, true);
    window.addEventListener("resize", updateGroupCoords);
    return () => {
      window.removeEventListener("scroll", updateGroupCoords, true);
      window.removeEventListener("resize", updateGroupCoords);
    };
  }, [isSpaceFilterOpen]);

  // Cerrar popover de espacios al hacer clic fuera o pulsar Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        groupBtnRef.current &&
        !groupBtnRef.current.contains(target) &&
        groupMenuRef.current &&
        !groupMenuRef.current.contains(target)
      ) {
        setIsSpaceFilterOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsSpaceFilterOpen(false);
      }
    }
    if (isSpaceFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSpaceFilterOpen]);

  // Paginación en modo lista
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Asistente y filtros avanzados (Fase 4)
  const [isRandomModalOpen, setIsRandomModalOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [isBulkAddListOpen, setIsBulkAddListOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [experienceFilter, setExperienceFilter] = useState<
    "all" | "visited_by_me" | "untried" | "favorite" | "pending"
  >("all");
  const expTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [expIndicator, setExpIndicator] = useState<{ left: number; width: number } | null>(null);

  const experienceCounts = useMemo(() => {
    let favorites = 0;
    let pending = 0;
    let visited = 0;
    for (const p of placesData) {
      if (p.isFavorite) favorites++;
      if (p.personalStatus === "pending") pending++;
      if (p.personalStatus === "visited" || (p.rating !== null && (p.rating ?? 0) > 0)) visited++;
    }
    return { total: placesData.length, favorites, pending, visited };
  }, [placesData]);

  useEffect(() => {
    const updateIndicator = () => {
      const btn = expTabRefs.current[experienceFilter];
      if (!btn || btn.offsetWidth === 0) return;
      setExpIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    };
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [
    experienceFilter,
    experienceCounts.total,
    experienceCounts.favorites,
    experienceCounts.pending,
    experienceCounts.visited,
    locale,
  ]);
  const [minRating, setMinRating] = useState<number | null>(null);
  // Filtro «Plan con amigos» (usuarios con los que vas + modo de coincidencia)
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [friendsFilterMode, setFriendsFilterMode] = useState<
    | "untried_or_pending"
    | "pending_all"
    | "pending_any"
    | "pending_any_even_visited"
    | "favorites_any"
    | "favorites_all"
    | "favorite_for_new"
    | "rated_high_any"
    | "discover_for_some"
    | "visited_all"
    | "added_by_group"
  >("untried_or_pending");
  const [includeMeWithFriends, setIncludeMeWithFriends] = useState(true);
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const urlHydratedRef = useRef(false);

  function toggleCountry(country: string) {
    setSelectedCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]
    );
    setSelectedCities([]);
    setSelectedTowns([]);
  }

  function toggleCity(city: string) {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
    setSelectedTowns([]);
  }

  function toggleTown(town: string) {
    setSelectedTowns((prev) =>
      prev.includes(town) ? prev.filter((t) => t !== town) : [...prev, town]
    );
  }

  // Atajo global Ctrl+K / ⌘+K y botón lupa móvil para abrir la paleta de comandos
  useEffect(() => {
    function onGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    }
    function onOpenPaletteEvent() {
      setIsCommandPaletteOpen(true);
    }
    window.addEventListener("keydown", onGlobalKeyDown);
    window.addEventListener(MOBILE_NAV_EVENTS.OPEN_COMMAND_PALETTE, onOpenPaletteEvent);
    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown);
      window.removeEventListener(MOBILE_NAV_EVENTS.OPEN_COMMAND_PALETTE, onOpenPaletteEvent);
    };
  }, []);

  // Restaurar filtros desde los query params de la URL al montar
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const city = params.get("city");
    const country = params.get("country");
    const price = params.get("price");
    const exp = params.get("exp");
    const occ = params.get("occ");
    const tag = params.get("tag");
    const towns = params.get("towns");
    const focus = params.get("focus");

    if (q) setTextSearch(q);
    if (city && city !== "all") setSelectedCities(city.split(",").filter(Boolean));
    if (country && country !== "all") setSelectedCountries(country.split(",").filter(Boolean));
    if (price) setSelectedPrices(price.split(",").filter(Boolean));
    if (
      exp === "visited_by_me" ||
      exp === "untried" ||
      exp === "favorite" ||
      exp === "pending"
    ) {
      setExperienceFilter(exp);
    }
    if (occ) setSelectedOccasions(occ.split(",").filter(Boolean));
    if (tag) setSelectedTags(tag.split(",").filter(Boolean));
    if (towns) setSelectedTowns(towns.split(",").filter(Boolean));
    if (focus) setPendingFocusId(focus);

    urlHydratedRef.current = true;
  }, []);

  // Sincronizar filtros activos con la URL para compartir vistas filtradas
  useEffect(() => {
    if (typeof window === "undefined" || !urlHydratedRef.current) return;
    const params = new URLSearchParams();
    if (textSearch.trim()) params.set("q", textSearch.trim());
    if (selectedCities.length > 0) params.set("city", selectedCities.join(","));
    if (selectedCountries.length > 0) params.set("country", selectedCountries.join(","));
    if (selectedPrices.length > 0) params.set("price", selectedPrices.join(","));
    if (experienceFilter !== "all") params.set("exp", experienceFilter);
    if (selectedOccasions.length > 0) params.set("occ", selectedOccasions.join(","));
    if (selectedTags.length > 0) params.set("tag", selectedTags.join(","));
    if (selectedTowns.length > 0) params.set("towns", selectedTowns.join(","));

    const qs = params.toString();
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [
    textSearch,
    selectedCities,
    selectedCountries,
    selectedPrices,
    experienceFilter,
    selectedOccasions,
    selectedTags,
    selectedTowns,
  ]);

  async function handleShareFilteredView() {
    if (typeof window === "undefined") return;
    const ok = await copyText(window.location.href);
    if (ok) {
      toast(t("places.share_view_copied"), { kind: "success" });
    }
  }

  // Registro PWA Service Worker y caché offline de favoritos / pendientes
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { });
    }

    // Guardar favoritos y pendientes en caché local para consulta sin cobertura
    try {
      const offlineCollection = placesData.filter(
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
  }, [placesData]);

  const toggleComparePlace = useCallback((placeId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(placeId)) return prev.filter((id) => id !== placeId);
      if (prev.length >= 3) return [...prev.slice(1), placeId];
      return [...prev, placeId];
    });
  }, []);

  // Geolocalización
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);

  // Ordenación de resultados
  const [sortBy, setSortBy] = useState<
    "recent" | "for_you" | "distance" | "name" | "price_asc" | "price_desc" | "rating"
  >("recent");

  const tasteProfile = useMemo(() => buildTasteProfile(placesData), [placesData]);
  const tasteSummary = useMemo(() => getTasteSummary(tasteProfile), [tasteProfile]);

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
    setExperienceFilter(
      c.experienceFilter === "visited_by_others" ? "all" : (c.experienceFilter || "all")
    );
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
      setLocationError(t("places.geo_not_supported"));
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
          setLocationError(t("places.geo_permission_denied"));
        } else {
          setLocationError(t("places.geo_unavailable"));
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
    setSelectedCountries([]);
    setSelectedCities([]);
    setSelectedTowns([]);
    setExperienceFilter("all");
    setMinRating(null);
    setSelectedFriendIds([]);
    setFriendsFilterMode("untried_or_pending");
    setIncludeMeWithFriends(true);
    setSelectedSpaceFilterIds([]);
    setTextSearch("");
    setUserLocation(null);
    setRadiusKm(null);
    setOccasionSearchQuery("");
    setTagSearchQuery("");
  }

  // Lista única de países y ciudades filtradas con contadores (priorizando columna country real)
  const { allCountries, countryCounts, availableCities, cityCounts } = useMemo(() => {
    const cMap = new Map<string, number>();
    placesData.forEach((p) => {
      const parsed = parseCityCountry(p.city, p.address);
      const effectiveCountry = p.country || parsed.country;
      if (effectiveCountry) cMap.set(effectiveCountry, (cMap.get(effectiveCountry) || 0) + 1);
    });
    const countries = Array.from(cMap.keys()).sort(
      (a, b) => (cMap.get(b) || 0) - (cMap.get(a) || 0) || a.localeCompare(b)
    );

    const cityMap = new Map<string, number>();
    placesData.forEach((p) => {
      const parsed = parseCityCountry(p.city, p.address);
      const effectiveCountry = p.country || parsed.country;
      if (selectedCountries.length === 0 || selectedCountries.includes(effectiveCountry)) {
        const filterCity = resolveFilterCity(p.city, p.address, p.country);
        if (filterCity) cityMap.set(filterCity, (cityMap.get(filterCity) || 0) + 1);
      }
    });
    const cities = Array.from(cityMap.keys()).sort(
      (a, b) => (cityMap.get(b) || 0) - (cityMap.get(a) || 0) || a.localeCompare(b)
    );

    return {
      allCountries: countries,
      countryCounts: cMap,
      availableCities: cities,
      cityCounts: cityMap,
    };
  }, [placesData, selectedCountries]);

  // Pueblos / municipios disponibles cuando se selecciona una o varias ciudades/provincias de España
  const availableTowns = useMemo(() => {
    if (selectedCities.length === 0) return [] as Array<{ name: string; count: number }>;
    const counts = new Map<string, number>();
    placesData.forEach((p) => {
      const parsed = parseCityCountry(p.city, p.address);
      const effectiveCountry = p.country || parsed.country;
      if (effectiveCountry !== "España") return;
      if (selectedCountries.length > 0 && !selectedCountries.includes(effectiveCountry)) return;
      const filterCity = resolveFilterCity(p.city, p.address, p.country);
      if (!selectedCities.includes(filterCity)) return;
      const rawTown = parsed.city.trim();
      if (rawTown) {
        counts.set(rawTown, (counts.get(rawTown) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
  }, [placesData, selectedCountries, selectedCities]);

  const countryOptions = useMemo(() => {
    return allCountries.map((c) => {
      const countryData = findCountry(c);
      const isEn = locale === "en";
      const title = isEn && countryData ? countryData.nameEn : c;
      const subtitle = countryData ? (isEn ? countryData.name : countryData.nameEn) : undefined;
      return {
        value: c,
        label: title,
        icon: countryData?.flag || "🌍",
        subtitle: subtitle !== title ? subtitle : undefined,
        count: countryCounts.get(c) || 0,
      };
    });
  }, [allCountries, countryCounts, locale]);

  const cityOptions = useMemo(() => {
    return availableCities.map((city) => ({
      value: city,
      label: city,
      count: cityCounts.get(city) || 0,
    }));
  }, [availableCities, cityCounts]);

  const townOptions = useMemo(() => {
    return availableTowns.map((tw) => ({
      value: tw.name,
      label: tw.name,
      count: tw.count,
    }));
  }, [availableTowns]);

  // Pre-indexar texto normalizado una única vez cuando cambia el catálogo (búsqueda O(1) en CPU por tecla)
  const searchIndexMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of placesData) {
      map.set(
        p.id,
        normalizeSearchText(
          [
            p.name,
            p.city || "",
            p.address || "",
            p.notes || "",
            p.privateNotes || "",
            p.createdByName || "",
            p.createdByUsername || "",
            p.createdByUsername ? `@${p.createdByUsername}` : "",
            ...p.tags,
            ...p.occasions,
            ...(p.commentsTexts || []),
            ...(p.commentAuthors || []),
            p.groupName || "",
          ].join(" ")
        )
      );
    }
    return map;
  }, [placesData]);

  // Filtrado y cálculo de distancias
  const filteredPlaces = useMemo(() => {
    let result = placesData.map((place) => {
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

    // 0. Búsqueda por texto libre universal (diferida con useDeferredValue e índice precalculado)
    if (deferredTextSearch.trim().length > 0) {
      const q = normalizeSearchText(deferredTextSearch);
      const tokens = q.split(/\s+/).filter(Boolean);
      result = result.filter((p) => {
        const searchableText = searchIndexMap.get(p.id) || "";

        return (
          searchableText.includes(q) ||
          (tokens.length > 1 && tokens.every((tok) => searchableText.includes(tok)))
        );
      });
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
    } else if (experienceFilter === "untried") {
      result = result.filter(
        (p) => p.personalStatus !== "visited" && (!p.rating || p.rating === 0)
      );
    }

    // 5. Filtro por Radio en Km
    if (userLocation && radiusKm && radiusKm > 0) {
      const radiusMeters = radiusKm * 1000;
      result = result.filter(
        (p) => p.distanceMeters != null && p.distanceMeters <= radiusMeters
      );
    }

    // 6. Filtro por Espacio (solo aplicable en vista combinada «Todos mis sitios»)
    if (workspaceMode === "all" && selectedSpaceFilterIds.length > 0) {
      result = result.filter((p) => {
        const spaceId = p.groupId || "personal";
        return selectedSpaceFilterIds.includes(spaceId);
      });
    }

    // 7. Filtro multiselección por País
    if (selectedCountries.length > 0) {
      result = result.filter((p) =>
        selectedCountries.includes(p.country || parseCityCountry(p.city, p.address).country)
      );
    }

    // 8. Filtro multiselección por Ciudad / Provincia
    if (selectedCities.length > 0) {
      result = result.filter((p) =>
        selectedCities.includes(resolveFilterCity(p.city, p.address, p.country))
      );
    }

    // 8b. Filtro multiselección por Pueblos / Municipios (dentro de la provincia española)
    if (selectedTowns.length > 0) {
      result = result.filter((p) =>
        selectedTowns.includes(parseCityCountry(p.city, p.address).city.trim())
      );
    }

    // 9. Filtro por Nota Mínima
    if (minRating !== null) {
      result = result.filter((p) => p.rating !== null && p.rating !== undefined && p.rating >= minRating);
    }

    // 10. Filtro «Plan con amigos» (pendientes o por descubrir para el grupo elegido)
    if (selectedFriendIds.length > 0) {
      const targetUserIds = includeMeWithFriends
        ? Array.from(new Set([currentUserId, ...selectedFriendIds]))
        : selectedFriendIds;

      result = result.filter((p) => {
        const visited = p.visitedUserIds || [];
        const pending = p.pendingUserIds || [];
        const favorites = p.favoriteUserIds || [];
        const highRated = p.highRatedUserIds || [];
        if (friendsFilterMode === "pending_all") {
          return targetUserIds.every((uid) => pending.includes(uid));
        }
        if (friendsFilterMode === "pending_any") {
          return (
            targetUserIds.some((uid) => pending.includes(uid)) &&
            targetUserIds.every((uid) => !visited.includes(uid))
          );
        }
        if (friendsFilterMode === "pending_any_even_visited") {
          return targetUserIds.some((uid) => pending.includes(uid));
        }
        if (friendsFilterMode === "favorites_any") {
          return targetUserIds.some((uid) => favorites.includes(uid));
        }
        if (friendsFilterMode === "favorites_all") {
          return targetUserIds.every((uid) => favorites.includes(uid));
        }
        if (friendsFilterMode === "favorite_for_new") {
          return (
            targetUserIds.some((uid) => favorites.includes(uid)) &&
            targetUserIds.some((uid) => !visited.includes(uid))
          );
        }
        if (friendsFilterMode === "rated_high_any") {
          return targetUserIds.some((uid) => highRated.includes(uid));
        }
        if (friendsFilterMode === "discover_for_some") {
          return (
            targetUserIds.some((uid) => visited.includes(uid)) &&
            targetUserIds.some((uid) => !visited.includes(uid))
          );
        }
        if (friendsFilterMode === "visited_all") {
          return targetUserIds.every((uid) => visited.includes(uid));
        }
        if (friendsFilterMode === "added_by_group") {
          return targetUserIds.includes(p.createdById);
        }
        // "untried_or_pending": ninguno de los seleccionados lo ha visitado todavía
        return targetUserIds.every((uid) => !visited.includes(uid));
      });
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
    } else if (sortBy === "for_you") {
      result.sort((a, b) => {
        const diff = scorePlaceByTaste(b, tasteProfile) - scorePlaceByTaste(a, tasteProfile);
        if (Math.abs(diff) > 0.01) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      // 'recent': más recientes primero
      result.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return result;
  }, [
    placesData,
    searchIndexMap,
    deferredTextSearch,
    selectedOccasions,
    selectedTags,
    selectedPrices,
    selectedCountries,
    selectedCities,
    selectedTowns,
    workspaceMode,
    selectedSpaceFilterIds,
    experienceFilter,
    minRating,
    selectedFriendIds,
    friendsFilterMode,
    includeMeWithFriends,
    currentUserId,
    userLocation,
    radiusKm,
    sortBy,
    tasteProfile,
  ]);

  // Al cambiar filtros, resetear a la primera página
  useEffect(() => {
    setCurrentPage(1);
  }, [
    deferredTextSearch,
    selectedOccasions,
    selectedTags,
    selectedPrices,
    selectedCountries,
    selectedCities,
    selectedTowns,
    workspaceMode,
    selectedSpaceFilterIds,
    experienceFilter,
    minRating,
    selectedFriendIds,
    friendsFilterMode,
    includeMeWithFriends,
    radiusKm,
    sortBy,
    tasteProfile,
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

  // Enfocar automáticamente un sitio recién añadido o editado (?focus=id)
  useEffect(() => {
    if (!pendingFocusId) return;
    const placeIndex = filteredPlaces.findIndex((p) => p.id === pendingFocusId);
    if (placeIndex === -1) return;

    setSelectedPlaceId(pendingFocusId);
    const targetPage = Math.floor(placeIndex / pageSize) + 1;
    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }

    const focusTargetId = pendingFocusId;
    setPendingFocusId(null);

    if (typeof window !== "undefined") {
      const scrollToCard = () => {
        const el = document.getElementById(`place-card-${focusTargetId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };
      setTimeout(scrollToCard, 80);
      setTimeout(scrollToCard, 250);
    }
  }, [pendingFocusId, filteredPlaces, pageSize, currentPage]);

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

  // Manejar clic en "Ver en mapa" desde una tarjeta (referencia estable para React.memo en PlaceCard)
  const handleSelectOnMap = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
    setActiveMobileView("map");
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.scrollTo({ top: 180, behavior: "smooth" });
    }
  }, []);

  // Manejar selección de un lugar para enfocarlo y hacer scroll en la lista
  function handleSelectInList(placeId: string) {
    setSelectedPlaceId(placeId);
    setActiveMobileView("list");

    const placeIndex = filteredPlaces.findIndex((p) => p.id === placeId);
    if (placeIndex !== -1) {
      const targetPage = Math.floor(placeIndex / pageSize) + 1;
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
      }
    }

    setTimeout(() => {
      const el = document.getElementById(`place-card-${placeId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  }

  // Manejar selección de un lugar desde una chincheta del mapa
  function handleSelectPlaceFromMap(placeId: string | null) {
    setSelectedPlaceId(placeId);
    if (!placeId) return;

    // 1. Encontrar la página donde está este lugar dentro de los resultados filtrados
    const placeIndex = filteredPlaces.findIndex((p) => p.id === placeId);
    if (placeIndex !== -1) {
      const targetPage = Math.floor(placeIndex / pageSize) + 1;
      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
      }
    }

    // 2. En pantallas de escritorio (donde la lista siempre está visible), desplazar suavemente hasta la tarjeta
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      const scrollToCard = () => {
        const el = document.getElementById(`place-card-${placeId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };
      setTimeout(scrollToCard, 50);
      setTimeout(scrollToCard, 150);
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
    const q = normalizeSearchText(occasionSearchQuery);
    if (!q) return sortedOccasions;
    return sortedOccasions.filter(
      (occ) =>
        normalizeSearchText(occ.name).includes(q) || normalizeSearchText(occ.id).includes(q)
    );
  }, [sortedOccasions, occasionSearchQuery]);

  // Etiquetas ordenadas por frecuencia de uso (las más usadas primero)
  const sortedTags = useMemo(() => {
    return [...tagsList].sort(
      (a, b) => (b.placesCount || 0) - (a.placesCount || 0) || a.name.localeCompare(b.name)
    );
  }, [tagsList]);

  const availableTagNames = useMemo(() => tagsList.map((t) => t.name), [tagsList]);

  // Filtrado de etiquetas por texto de búsqueda
  const filteredTags = useMemo(() => {
    const q = normalizeSearchText(tagSearchQuery);
    if (!q) return sortedTags;
    return sortedTags.filter((t) => normalizeSearchText(t.name).includes(q));
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
    selectedCountries.length +
    selectedCities.length +
    selectedTowns.length +
    (experienceFilter !== "all" ? 1 : 0) +
    (minRating !== null ? 1 : 0) +
    (selectedFriendIds.length > 0 ? 1 : 0) +
    (userLocation ? 1 : 0) +
    (textSearch.trim() ? 1 : 0);

  const otherCommunityUsers = useMemo(
    () => communityUsers.filter((u) => u.id !== currentUserId),
    [communityUsers, currentUserId]
  );

  const friendSelectOptions = useMemo(
    () =>
      otherCommunityUsers.map((u) => ({
        value: u.id,
        label: u.username ? `@${u.username}` : u.name,
        subtitle: u.username ? u.name : undefined,
      })),
    [otherCommunityUsers]
  );

  const isFiltered =
    activeFiltersCount > 0 ||
    (workspaceMode === "all" && selectedSpaceFilterIds.length > 0) ||
    radiusKm != null;

  return (
    <div className="w-full space-y-4">
      {/* Banner de modo offline y sincronización de cola IndexedDB */}
      <OfflineSyncBanner />

      {/* =========================================================================
          0. CABECERA MÓVIL STITCH (Componente modular MobileFilterBar)
         ========================================================================= */}
      <MobileFilterBar
        textSearch={textSearch}
        onTextSearchChange={setTextSearch}
        showExtraFilters={isAssistantOpen}
        onToggleExtraFilters={() => setIsAssistantOpen((prev) => !prev)}
        activeFiltersCount={activeFiltersCount}
        activeMobileView={activeMobileView}
        onToggleMobileView={() =>
          setActiveMobileView((prev) => (prev === "map" ? "list" : "map"))
        }
        initialPlaces={placesData}
        filteredPlacesCount={filteredPlaces.length}
        experienceFilter={experienceFilter}
        onSelectExperience={(exp) => {
          setExperienceFilter(exp);
          setCurrentPage(1);
        }}
        sortedOccasions={sortedOccasions}
        selectedOccasions={selectedOccasions}
        onToggleOccasion={toggleOccasion}
        onClearOccasions={() => setSelectedOccasions([])}
        userLocation={userLocation}
        isLocating={isLocating}
        onToggleLocation={userLocation ? handleDisableLocation : handleRequestLocation}
        onOpenRandom={() => setIsRandomModalOpen(true)}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onResetFilters={resetAllFilters}
        onOpenBulkAddToList={() => setIsBulkAddListOpen(true)}
        isSaveFilterOpen={isSaveFilterOpen}
        onToggleSaveFilter={() => setIsSaveFilterOpen((v) => !v)}
      />

      {/* Mini formulario móvil para guardar combinación actual de filtros */}
      {isSaveFilterOpen && (
        <form
          onSubmit={handleSaveCurrentFilter}
          className="lg:hidden flex items-center gap-2 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs animate-in fade-in duration-150"
        >
          <input
            type="text"
            value={newFilterName}
            onChange={(e) => setNewFilterName(e.target.value)}
            placeholder="Ej. Tapear sin estrenar, Citas baratas..."
            autoFocus
            className="flex-1 min-w-0 px-3 py-1.5 rounded-full text-base sm:text-xs bg-[#f2f3ff] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={savingFilter || newFilterName.trim().length < 2}
            className="px-3 py-1.5 rounded-full bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-40 shrink-0"
          >
            {savingFilter ? "..." : t("common.save")}
          </button>
          <button
            type="button"
            onClick={() => setIsSaveFilterOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-base leading-none">close</span>
          </button>
        </form>
      )}

      {/* =========================================================================
          1. HERO ACTION HUB (Desktop): Búsqueda interactiva y botones de acción rápida
         ========================================================================= */}
      <section className="hidden lg:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-2 sm:px-3 border border-slate-200/70 dark:border-slate-800/70">
        <div className="flex flex-col md:flex-row items-center gap-2">
          {/* Buscador de texto en vivo redondeado estilo Stitch */}
          <div className="relative flex-1 w-full flex items-center bg-[#f2f3ff] dark:bg-slate-800/70 rounded-full px-3.5 py-1.5 transition-all focus-within:ring-2 focus-within:ring-orange-500/50">
            <span className="material-symbols-outlined text-orange-600 text-lg mr-2 select-none shrink-0">search</span>
            <input
              type="text"
              value={textSearch}
              onChange={(e) => setTextSearch(e.target.value)}
              placeholder={t("places.search_placeholder")}
              className="w-full bg-transparent text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
            {textSearch && (
              <button
                type="button"
                onClick={() => setTextSearch("")}
                className="p-0.5 rounded-full text-slate-400 hover:text-red-500 cursor-pointer"
                title={t("places.clear_filter")}
              >
                <span className="material-symbols-outlined text-sm leading-none">close</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden sm:inline-flex items-center gap-0.5 ml-1.5 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-orange-600 hover:border-orange-400 transition cursor-pointer shrink-0"
              title="Ctrl+K / ⌘K"
            >
              ⌘K
            </button>
          </div>

          {/* Acciones Rápidas en píldoras horizontales */}
          <div className="flex items-center gap-1.5 w-full md:w-auto shrink-0 justify-between md:justify-start overflow-x-auto">
            {/* Al azar */}
            <button
              type="button"
              onClick={() => setIsRandomModalOpen(true)}
              disabled={filteredPlaces.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer disabled:opacity-40"
              title={t("places.roulette_tooltip")}
            >
              <span className="material-symbols-outlined text-amber-500 text-base leading-none">casino</span>
              <span className="hidden sm:inline">{t("places.roulette")}</span>
            </button>

            {/* Importar / Exportar */}
            <button
              type="button"
              onClick={() => setIsExportImportOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer"
              title={t("places.export_import_tooltip")}
            >
              <span className="material-symbols-outlined text-slate-500 text-base leading-none">import_export</span>
              <span className="hidden sm:inline">{t("places.export_import")}</span>
            </button>

            {/* Cerca de mí */}
            {!userLocation ? (
              <button
                type="button"
                onClick={handleRequestLocation}
                disabled={isLocating}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800/80 text-orange-600 dark:text-orange-400 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base leading-none">{isLocating ? "hourglass_empty" : "near_me"}</span>
                <span className="hidden sm:inline">{isLocating ? t("places.locating") : t("places.near_me")}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/25 text-xs font-semibold shrink-0 gm-popover-in">
                <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                  <span className="gm-pin-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                <span className="text-xs">{t("places.location_active")}</span>
                <button
                  type="button"
                  onClick={handleDisableLocation}
                  aria-label={t("places.clear_filter")}
                  className="ml-1 text-slate-400 hover:text-red-400 cursor-pointer font-bold text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Botón Añadir */}
            <a
              href="/new"
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white text-xs font-bold shadow-sm hover:shadow transition shrink-0 ml-0.5"
            >
              <span className="material-symbols-outlined text-base leading-none">add</span>
              <span>{t("places.add_new")}</span>
            </a>
          </div>
        </div>
      </section>

      {locationError && (
        <div className="p-3 rounded-2xl bg-red-950/40 border border-red-900/50 text-red-400 text-xs flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base leading-none">warning</span>
            <span>{locationError}</span>
          </span>
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
          <span className="text-[11px] font-bold text-slate-400 shrink-0">{t("places.radius_label")}</span>
          {[
            { label: t("places.all"), val: null },
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
                className={`px-2.5 py-1 rounded-full font-semibold shrink-0 transition cursor-pointer text-xs ${isSelected
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          2. TAXONOMÍAS, FILTROS Y ESTADOS (Desktop): Fila 1 y Fila 2 estilo Stitch
         ========================================================================= */}
      <section className="hidden lg:flex flex-col gap-2.5 bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800/70">
        {/* Fila 1: Píldoras de Experiencia / Colección + Filtros Guardados */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-2">
          <div className="relative flex items-stretch gap-1 bg-[#f2f3ff] dark:bg-slate-800/70 p-1 rounded-full overflow-x-auto scrollbar-none text-xs font-semibold">
            {expIndicator && (
              <span
                aria-hidden="true"
                style={{
                  transform: `translateX(${expIndicator.left}px)`,
                  width: `${expIndicator.width}px`,
                }}
                className={`pointer-events-none absolute top-1 bottom-1 left-0 rounded-full shadow-xs transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  experienceFilter === "untried"
                    ? "bg-[#ffddb8]"
                    : "bg-slate-900 dark:bg-white"
                }`}
              />
            )}
            {[
              { key: "all", icon: null, iconClass: "", label: `${t("places.all")} (${experienceCounts.total})` },
              { key: "favorite", icon: "star", iconClass: "text-amber-500", label: `${t("places.favorites")} (${experienceCounts.favorites})` },
              { key: "pending", icon: "schedule", iconClass: "text-orange-600 dark:text-orange-400", label: `${t("places.want_to_go")} (${experienceCounts.pending})` },
              { key: "visited_by_me", icon: "check_circle", iconClass: "text-emerald-600 dark:text-emerald-400", label: `${t("places.visited")} (${experienceCounts.visited})` },
              { key: "untried", icon: "auto_awesome", iconClass: "text-amber-600 dark:text-amber-400", label: t("places.unexplored") },
            ].map((item) => {
              const active = experienceFilter === item.key;
              const isUntried = item.key === "untried";
              return (
                <button
                  key={item.key}
                  ref={(el) => {
                    expTabRefs.current[item.key] = el;
                  }}
                  type="button"
                  onClick={() => {
                    setExperienceFilter(active && item.key !== "all" ? "all" : (item.key as typeof experienceFilter));
                    setCurrentPage(1);
                  }}
                  className={`relative z-10 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors duration-200 cursor-pointer ${active
                    ? isUntried
                      ? `${!expIndicator ? "bg-[#ffddb8] shadow-xs " : ""}text-[#684000] font-black`
                      : `${!expIndicator ? "bg-slate-900 dark:bg-white shadow-xs " : ""}text-white dark:text-slate-900 font-bold`
                    : isUntried
                      ? "text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/40 hover:bg-amber-200/60 font-semibold"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 font-semibold"
                    }`}
                >
                  {item.icon && (
                    <span
                      className={`material-symbols-outlined ${isUntried ? "text-[14px]" : "text-[15px]"} leading-none ${active && !isUntried ? "text-current" : item.iconClass
                        }`}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs">
            {filteredPlaces.length > 0 && (
              <button
                type="button"
                onClick={() => setIsBulkAddListOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/50 text-xs font-semibold transition cursor-pointer"
                title={t("lists.bulk_add_view_tooltip", { count: String(filteredPlaces.length) })}
              >
                <span className="material-symbols-outlined text-sm leading-none">playlist_add</span>
                <span className="hidden sm:inline">{t("lists.bulk_add_view_btn")}</span>
              </button>
            )}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleShareFilteredView}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-950/70 text-orange-700 dark:text-orange-300 border border-orange-200/70 dark:border-orange-800/50 text-xs font-semibold transition cursor-pointer"
                title={t("places.share_view")}
              >
                <span className="material-symbols-outlined text-sm leading-none">share</span>
                <span className="hidden sm:inline">{t("places.share_view")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsSaveFilterOpen((v) => !v)}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
              title={t("places.save_filter_tooltip")}
            >
              <span className="material-symbols-outlined text-sm text-amber-600 leading-none">bookmark</span>
              <span>{t("places.save_filter")}</span>
            </button>
          </div>
        </div>

        {/* Mini formulario para guardar combinación actual de filtros */}
        {isSaveFilterOpen && (
          <form
            onSubmit={handleSaveCurrentFilter}
            className="flex items-center gap-2 pt-1 border-b border-slate-100 dark:border-slate-800/60 pb-2 animate-in fade-in duration-150"
          >
            <input
              type="text"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              placeholder="Ej. Tapear sin estrenar, Citas baratas..."
              autoFocus
              className="flex-1 px-3 py-1.5 rounded-full text-xs bg-[#f2f3ff] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={savingFilter || newFilterName.trim().length < 2}
              className="px-3 py-1.5 rounded-full bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-40 shrink-0"
            >
              {savingFilter ? "..." : t("common.save")}
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
          <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/60 pb-2 overflow-x-auto no-scrollbar">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 shrink-0">
              <span className="material-symbols-outlined text-sm text-orange-600 leading-none">bookmark</span>
              <span>Mis filtros:</span>
            </span>
            {savedFilters.map((sf) => (
              <div
                key={sf.id}
                className="inline-flex items-center rounded-full bg-[#f2f3ff] dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 text-[11px] shrink-0 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleApplySavedFilter(sf)}
                  className="px-2.5 py-0.5 font-semibold text-slate-700 dark:text-slate-200 hover:text-orange-600 transition cursor-pointer"
                  title={t("places.apply_filter_tooltip")}
                >
                  {sf.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSavedFilter(sf.id)}
                  className="pr-2 pl-0.5 py-0.5 text-slate-400 hover:text-red-500 transition cursor-pointer text-[10px]"
                  title={t("places.delete_filter_tooltip")}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Fila 2: Segmentación por Grupos, Ubicación, Precios, Categorías y Tags */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* Filtro por Espacio (solo en vista combinada 'all') */}
            {workspaceMode === "all" && availableSpaces.length > 1 && (
              <div className="relative shrink-0">
                <button
                  ref={groupBtnRef}
                  type="button"
                  onClick={() => {
                    if (!isSpaceFilterOpen) {
                      updateGroupCoords();
                      setIsSpaceFilterOpen(true);
                    } else {
                      setIsSpaceFilterOpen(false);
                    }
                  }}
                  className={`px-3 py-1 rounded-full font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer text-xs border ${selectedSpaceFilterIds.length > 0
                    ? "bg-orange-600 border-orange-600 text-white shadow-xs"
                    : "bg-[#f2f3ff] dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                >
                  <span className="material-symbols-outlined text-[15px] leading-none text-orange-600">
                    workspaces
                  </span>
                  <span>
                    {selectedSpaceFilterIds.length === 0
                      ? t("spaces.filter_by_space")
                      : selectedSpaceFilterIds.length === 1
                        ? availableSpaces.find((sp) => sp.id === selectedSpaceFilterIds[0])?.name || t("spaces.filter_by_space")
                        : `${selectedSpaceFilterIds.length} ${t("spaces.spaces_count_label")}`}
                  </span>
                  <span className="text-[10px]">{isSpaceFilterOpen ? "▲" : "▼"}</span>
                </button>

                {mounted && isSpaceFilterOpen && groupCoords &&
                  createPortal(
                    <div
                      ref={groupMenuRef}
                      style={{
                        position: "fixed",
                        top: `${groupCoords.top}px`,
                        left: `${groupCoords.left}px`,
                      }}
                      className="z-[9999] w-64 sm:w-72 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 space-y-2 text-left animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {t("spaces.filter_by_space")}
                        </span>
                        {selectedSpaceFilterIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedSpaceFilterIds([])}
                            className="text-[10px] text-amber-500 font-semibold hover:underline cursor-pointer"
                          >
                            {t("places.clear_filter")}
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        {availableSpaces.map((sp) => {
                          const isSelected = selectedSpaceFilterIds.includes(sp.id);
                          return (
                            <button
                              key={sp.id}
                              type="button"
                              onClick={() => {
                                setSelectedSpaceFilterIds((prev) =>
                                  prev.includes(sp.id)
                                    ? prev.filter((id) => id !== sp.id)
                                    : [...prev, sp.id]
                                );
                              }}
                              className={`w-full px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${isSelected
                                ? "bg-orange-600 text-white font-bold"
                                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                            >
                              <span className="inline-flex items-center gap-1.5 truncate">
                                <span className="shrink-0">{sp.icon || "🍻"}</span>
                                <span className="truncate">{sp.name}</span>
                              </span>
                              {isSelected && <span className="text-xs">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>,
                    document.body
                  )}
              </div>
            )}

            {/* Países (multiselección) */}
            {allCountries.length > 0 && (
              <MultiSearchableSelect
                values={selectedCountries}
                onChange={(vals) => {
                  setSelectedCountries(vals);
                  setSelectedCities([]);
                  setSelectedTowns([]);
                  setCurrentPage(1);
                }}
                options={countryOptions}
                placeholder={`${t("places.all_countries")} (${allCountries.length})`}
                clearLabel={t("places.clear_filter")}
                searchPlaceholder={t("location.country_placeholder")}
                icon={
                  <span className="material-symbols-outlined text-[16px] leading-none">
                    public
                  </span>
                }
                className="shrink-0"
              />
            )}

            {/* Ciudades / Provincias (multiselección) */}
            {availableCities.length > 0 && (
              <MultiSearchableSelect
                values={selectedCities}
                onChange={(vals) => {
                  setSelectedCities(vals);
                  setSelectedTowns([]);
                  setCurrentPage(1);
                }}
                options={cityOptions}
                placeholder={`${t("places.all_cities")} (${availableCities.length})`}
                clearLabel={t("places.clear_filter")}
                searchPlaceholder={t("location.city_placeholder")}
                icon={
                  <span className="material-symbols-outlined text-[16px] leading-none">
                    location_city
                  </span>
                }
                className="shrink-0"
              />
            )}

            {/* Pueblos / Municipios (multiselección cuando se elige provincia española con >1 localidad) */}
            {selectedCities.length > 0 && availableTowns.length > 1 && (
              <MultiSearchableSelect
                values={selectedTowns}
                onChange={(vals) => {
                  setSelectedTowns(vals);
                  setCurrentPage(1);
                }}
                options={townOptions}
                placeholder={`${t("places.towns_filter")} (${availableTowns.length})`}
                clearLabel={t("places.clear_filter")}
                searchPlaceholder={t("places.search_towns_placeholder")}
                icon={
                  <span className="material-symbols-outlined text-[16px] leading-none">
                    holiday_village
                  </span>
                }
                className="shrink-0 gm-popover-in"
              />
            )}

            {/* Precios */}
            {[
              { id: "€", label: "< 20 €" },
              { id: "€€", label: "20-30 €" },
              { id: "€€€", label: "30-40 €" },
              { id: "€€€€", label: "> 40 €" },
            ].map((item) => {
              const active = selectedPrices.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => togglePrice(item.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition cursor-pointer ${active
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                >
                  {item.label}
                </button>
              );
            })}

            {/* Categorías destacadas */}
            {occasionsList.slice(0, 2).map((occ) => {
              const isSelected = selectedOccasions.includes(occ.id);
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => toggleOccasion(occ.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer flex items-center gap-1 ${isSelected
                    ? "bg-[#855300] text-white font-bold shadow-xs"
                    : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                >
                  <OccasionIcon icon={occ.icon} msClassName="text-[14px]" />
                  <span>{occ.name}</span>
                </button>
              );
            })}

            {/* Tags destacados */}
            {tagsList.slice(0, 2).map((tg) => {
              const isSelectedTag = selectedTags.includes(tg.id);
              return (
                <button
                  key={tg.id}
                  type="button"
                  onClick={() => toggleTag(tg.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${isSelectedTag
                    ? "bg-orange-600 text-white font-bold"
                    : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                    }`}
                >
                  #{tg.name}
                </button>
              );
            })}
          </div>

          {/* Lado derecho: botón unificado Filtros (abre el modal completo de filtros) */}
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setIsAssistantOpen(true)}
              aria-expanded={isAssistantOpen}
              className={`group flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-extrabold transition-all duration-200 active:scale-95 cursor-pointer border ${isAssistantOpen || activeFiltersCount > 0
                ? "bg-orange-600 border-orange-600 text-white shadow-sm shadow-orange-600/25"
                : "bg-orange-50 dark:bg-orange-950/50 border-orange-200/90 dark:border-orange-800/70 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-950/80"
                }`}
            >
              <span
                className={`material-symbols-outlined text-sm leading-none transition-transform duration-300 ${isAssistantOpen ? "rotate-90" : "group-hover:rotate-12"
                  }`}
              >
                tune
              </span>
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
                onClick={resetAllFilters}
                title={t("places.reset_filters")}
                aria-label={t("places.reset_filters")}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full font-bold transition active:scale-95 cursor-pointer bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-950/80 border border-rose-200/80 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 gm-popover-in"
              >
                <span className="material-symbols-outlined text-sm leading-none">filter_alt_off</span>
                <span>{t("places.clear_filter")}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Panel desplegable de Filtros Avanzados (en escritorio; en móvil se usa el modal unificado) */}
      {showExtraFilters && (
        <div className="hidden lg:block space-y-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs gm-panel-reveal">
          {/* Cabecera del panel de filtros en móvil */}
          <div className="lg:hidden flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-base leading-none">tune</span>
              </span>
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                  {t("places.more_filters").replace(/^\+\s*/, "")}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  {filteredPlaces.length}{" "}
                  {filteredPlaces.length === 1
                    ? t("places.locale_single")
                    : t("places.locales_count")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[11px] font-bold cursor-pointer"
                >
                  {t("places.clear_filter")} ({activeFiltersCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowExtraFilters(false)}
                aria-label={t("common.close")}
                className="w-7 h-7 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base leading-none">close</span>
              </button>
            </div>
          </div>

          {/* Secciones estructuradas exclusivas de móvil: Ubicación, Presupuesto y Grupos */}
          <div className="lg:hidden space-y-3.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            {/* 1. Ubicación (Países, Ciudades y Pueblos buscables y multiselección en móvil) */}
            {(allCountries.length > 0 || availableCities.length > 0) && (
              <div className="space-y-2">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-0.5">
                  {t("places.country_filter")} / {t("places.city_filter")}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allCountries.length > 0 && (
                    <MultiSearchableSelect
                      fullWidth
                      values={selectedCountries}
                      onChange={(vals) => {
                        setSelectedCountries(vals);
                        setSelectedCities([]);
                        setSelectedTowns([]);
                        setCurrentPage(1);
                      }}
                      options={countryOptions}
                      placeholder={`${t("places.all_countries")} (${allCountries.length})`}
                      clearLabel={t("places.clear_filter")}
                      searchPlaceholder={t("location.country_placeholder")}
                      icon={
                        <span className="material-symbols-outlined text-[16px] leading-none">
                          public
                        </span>
                      }
                    />
                  )}

                  {availableCities.length > 0 && (
                    <MultiSearchableSelect
                      fullWidth
                      values={selectedCities}
                      onChange={(vals) => {
                        setSelectedCities(vals);
                        setSelectedTowns([]);
                        setCurrentPage(1);
                      }}
                      options={cityOptions}
                      placeholder={`${t("places.all_cities")} (${availableCities.length})`}
                      clearLabel={t("places.clear_filter")}
                      searchPlaceholder={t("location.city_placeholder")}
                      icon={
                        <span className="material-symbols-outlined text-[16px] leading-none">
                          location_city
                        </span>
                      }
                    />
                  )}
                </div>

                {/* Pueblos / Municipios buscables y multiselección en móvil */}
                {selectedCities.length > 0 && availableTowns.length > 1 && (
                  <div className="gm-panel-reveal">
                    <MultiSearchableSelect
                      fullWidth
                      values={selectedTowns}
                      onChange={(vals) => {
                        setSelectedTowns(vals);
                        setCurrentPage(1);
                      }}
                      options={townOptions}
                      placeholder={`${t("places.towns_filter")} (${availableTowns.length})`}
                      clearLabel={t("places.clear_filter")}
                      searchPlaceholder={t("places.search_towns_placeholder")}
                      icon={
                        <span className="material-symbols-outlined text-[16px] leading-none">
                          holiday_village
                        </span>
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {/* 2. Presupuesto (4 columnas exactas) */}
            <div className="space-y-1.5">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-0.5">
                {t("form.price_label")}
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { val: "€", label: "< 20 €" },
                  { val: "€€", label: "20-30 €" },
                  { val: "€€€", label: "30-40 €" },
                  { val: "€€€€", label: "> 40 €" },
                ].map((pr) => {
                  const active = selectedPrices.includes(pr.val);
                  return (
                    <button
                      key={pr.val}
                      type="button"
                      onClick={() => togglePrice(pr.val)}
                      className={`py-2 px-1 rounded-2xl text-[11px] font-extrabold text-center transition cursor-pointer border ${active
                        ? "bg-orange-600 border-orange-600 text-white shadow-xs"
                        : "bg-[#f8f9ff] dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                        }`}
                    >
                      {pr.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Espacio (solo en vista combinada «Todos mis sitios») */}
            {workspaceMode === "all" && availableSpaces.length > 1 && (
              <div className="space-y-1.5">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-0.5">
                  {t("spaces.filter_by_space")}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {availableSpaces.map((sp) => {
                    const active = selectedSpaceFilterIds.includes(sp.id);
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() =>
                          setSelectedSpaceFilterIds((prev) =>
                            prev.includes(sp.id)
                              ? prev.filter((id) => id !== sp.id)
                              : [...prev, sp.id]
                          )
                        }
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer border ${active
                          ? "bg-orange-600 border-orange-600 text-white shadow-xs"
                          : "bg-[#f8f9ff] dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                          }`}
                      >
                        <span>{sp.icon || "🍻"}</span>
                        <span>{sp.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {/* Filtro rápido por Nota mínima (visible en escritorio y móvil dentro de Más filtros) */}
          <div className="flex items-center justify-between gap-2 flex-wrap pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-amber-500 leading-none">star</span>
              <span>{t("places.min_rating_label")}</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { val: null as number | null, label: t("places.min_rating_any") },
                { val: 7, label: "★ 7+" },
                { val: 8, label: "★ 8+" },
                { val: 9, label: "★ 9+" },
              ].map((opt) => {
                const active = minRating === opt.val;
                return (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => setMinRating(opt.val)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-150 active:scale-95 cursor-pointer ${active
                      ? "bg-amber-500 text-white shadow-xs"
                      : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtro «Plan con amigos»: sitios pendientes o por descubrir para los usuarios elegidos */}
          {friendSelectOptions.length > 0 && (
            <div className="space-y-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-orange-600 leading-none">
                    diversity_3
                  </span>
                  <span>{t("friends_filter.title")}</span>
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <MultiSearchableSelect
                    values={selectedFriendIds}
                    onChange={setSelectedFriendIds}
                    options={friendSelectOptions}
                    placeholder={t("friends_filter.select_placeholder")}
                    clearLabel={t("friends_filter.clear")}
                    searchPlaceholder={t("friends_filter.search_placeholder")}
                    emptyText={t("places.no_results")}
                    icon={<span className="material-symbols-outlined text-[15px] leading-none">person_add</span>}
                  />
                  {selectedFriendIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedFriendIds([])}
                      className="text-[11px] text-rose-500 hover:underline font-bold cursor-pointer"
                    >
                      {t("friends_filter.clear")}
                    </button>
                  )}
                </div>
              </div>

              {selectedFriendIds.length > 0 && (
                <div className="flex items-center justify-between gap-2.5 flex-wrap pt-1">
                  <CustomSelect
                    value={friendsFilterMode}
                    onChange={setFriendsFilterMode}
                    align="left"
                    buttonClassName="px-3 py-1.5 text-[11px]"
                    ariaLabel={t("friends_filter.title")}
                    options={[
                      {
                        value: "untried_or_pending",
                        label: t("friends_filter.mode_untried_or_pending"),
                        icon: <span className="material-symbols-outlined text-sm leading-none text-orange-600">auto_awesome</span>,
                      },
                      {
                        value: "pending_all",
                        label: t("friends_filter.mode_pending_all"),
                        icon: <span className="material-symbols-outlined text-sm leading-none text-amber-500">schedule</span>,
                      },
                      {
                        value: "pending_any",
                        label: t("friends_filter.mode_pending_any"),
                        icon: <span className="material-symbols-outlined text-sm leading-none text-amber-500">hourglass_top</span>,
                      },
                      {
                        value: "pending_any_even_visited",
                        label: t("friends_filter.mode_pending_any_even_visited"),
                        icon: <span className="material-symbols-outlined text-sm leading-none text-amber-600">bookmark</span>,
                      },
                      {
                        value: "favorites_any",
                        label: t("friends_filter.mode_favorites_any"),
                        icon: <span className="material-symbols-outlined text-sm leading-none text-rose-500">favorite</span>,
                      },
                      {
                        value: "favorites_all",
                        label: t("friends_filter.mode_favorites_all"),
                        icon: <span className="material-symbols-outlined text-sm leading-none text-rose-600">volunteer_activism</span>,
                      },
                      {
                        value: "favorite_for_new",
                        label: t("friends_filter.mode_favorite_for_new"),
                        icon: <span className="material-symbols-outlined text-sm leading-none text-pink-500">redeem</span>,
                      },
                      {
                        value: "rated_high_any",
                        label: t("friends_filter.mode_rated_high_any"),
                        icon: <span className="material-symbols-outlined text-sm leading-none text-yellow-500">star</span>,
                      },
                      {
                        value: "discover_for_some",
                        label: t("friends_filter.mode_discover_for_some"),
                        icon: <span className="material-symbols-outlined text-sm leading-none text-indigo-500">explore</span>,
                      },
                      {
                        value: "visited_all",
                        label: t("friends_filter.mode_visited_all"),
                        icon: <span className="material-symbols-outlined text-sm leading-none text-emerald-600">check_circle</span>,
                      },
                      {
                        value: "added_by_group",
                        label: t("friends_filter.mode_added_by_group"),
                        icon: <span className="material-symbols-outlined text-sm leading-none text-sky-600">person_pin_circle</span>,
                      },
                    ]}
                  />
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeMeWithFriends}
                      onChange={(e) => setIncludeMeWithFriends(e.target.checked)}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span>{t("friends_filter.include_me")}</span>
                  </label>
                  <p className="w-full text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {t(`friends_filter.desc_${friendsFilterMode}`)}
                  </p>
                </div>
              )}
            </div>
          )}

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

              <div className="flex items-center gap-2.5">
                {occasionsList.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setIsOccasionSearchOpen(!isOccasionSearchOpen)}
                    className={`font-semibold transition cursor-pointer inline-flex items-center gap-1 ${isOccasionSearchOpen || occasionSearchQuery
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    title={t("places.search_categories_title")}
                  >
                    <span className="material-symbols-outlined text-[15px] leading-none">search</span>
                    <span className="hidden sm:inline">{t("places.search_categories_btn")}</span>
                  </button>
                )}

                {occasionsList.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setIsOccasionsWrapped(!isOccasionsWrapped)}
                    className="font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px] leading-none">
                      {isOccasionsWrapped ? "view_carousel" : "grid_view"}
                    </span>
                    <span>
                      {(isOccasionsWrapped ? t("places.row_mode") : t("places.grid_mode")).replace(
                        /^[↔⊞]\s*/,
                        ""
                      )}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Buscador de categorías si está abierto */}
            {isOccasionSearchOpen && (
              <div className="relative gm-panel-reveal">
                <span className="material-symbols-outlined text-base text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none leading-none">
                  search
                </span>
                <input
                  type="text"
                  value={occasionSearchQuery}
                  onChange={(e) => setOccasionSearchQuery(e.target.value)}
                  placeholder={t("places.search_occasions_placeholder")}
                  className="w-full pl-9 pr-8 py-1.5 rounded-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition"
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
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 gm-panel-reveal">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedOccasions([])}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${selectedOccasions.length === 0
                      ? "bg-orange-600 text-white shadow-md font-black"
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${isSelected
                          ? "bg-orange-600 text-white shadow-md font-black ring-2 ring-orange-500/40"
                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                          }`}
                      >
                        <OccasionIcon icon={occ.icon} msClassName="text-[14px]" />
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
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition cursor-pointer ${selectedOccasions.length === 0
                    ? "bg-orange-600 text-white shadow-md font-black"
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
                      className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${isSelected
                        ? "bg-orange-600 text-white shadow-md font-black ring-2 ring-orange-500/40"
                        : "bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 shadow-xs dark:shadow-none"
                        }`}
                    >
                      <OccasionIcon icon={occ.icon} msClassName="text-[14px]" />
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
                    className="px-3 py-2 rounded-2xl text-xs font-bold shrink-0 border border-dashed border-orange-400/70 dark:border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition cursor-pointer"
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
                    className="font-semibold text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 transition cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px] leading-none">
                      {isTagsExpanded ? "expand_less" : "search"}
                    </span>
                    <span>
                      {(isTagsExpanded
                        ? t("places.hide_search")
                        : t("places.search_show_more")
                      ).replace(/^[^\p{L}\p{N}]+/u, "")}
                    </span>
                  </button>
                </div>
              </div>

              {isTagsExpanded ? (
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 gm-panel-reveal">
                  <div className="relative">
                    <span className="material-symbols-outlined text-base text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none leading-none">
                      search
                    </span>
                    <input
                      type="text"
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                      placeholder={t("places.search_tags_placeholder")}
                      className="w-full pl-9 pr-8 py-1.5 rounded-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition"
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
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer border ${isSelected
                              ? "bg-orange-100 dark:bg-orange-500/20 border-orange-300 dark:border-orange-500/50 text-orange-900 dark:text-orange-300 font-bold ring-1 ring-orange-500/30 shadow-xs"
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
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium shrink-0 transition cursor-pointer border ${isSelected
                          ? "bg-orange-100 dark:bg-orange-500/20 border-orange-300 dark:border-orange-500/50 text-orange-900 dark:text-orange-300 font-bold ring-1 ring-orange-500/30 shadow-xs"
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
                      className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold shrink-0 border border-dashed border-orange-400/70 dark:border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition cursor-pointer"
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

          {/* Pie de utilidades y botón aplicar en móvil */}
          <div className="lg:hidden pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowExtraFilters(false);
                  setIsExportImportOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold cursor-pointer"
                title={t("places.export_import")}
              >
                <span className="material-symbols-outlined text-sm leading-none">import_export</span>
                <span>{t("places.export_import")}</span>
              </button>
              {filteredPlaces.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowExtraFilters(false);
                    setIsBulkAddListOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold cursor-pointer"
                  title={t("lists.bulk_add_view_tooltip", { count: String(filteredPlaces.length) })}
                >
                  <span className="material-symbols-outlined text-sm leading-none">playlist_add</span>
                  <span>{t("lists.bulk_add_view_btn")}</span>
                </button>
              )}
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleShareFilteredView}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 cursor-pointer"
                  title={t("places.share_view")}
                  aria-label={t("places.share_view")}
                >
                  <span className="material-symbols-outlined text-base leading-none">share</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowExtraFilters(false);
                  setIsSaveFilterOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer"
                title={t("places.save_filter_tooltip")}
              >
                <span className="material-symbols-outlined text-sm text-amber-600 leading-none">bookmark</span>
                <span>{t("places.save_filter")}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowExtraFilters(false)}
              className="px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold shadow-xs active:scale-95 transition cursor-pointer shrink-0"
            >
              {filteredPlaces.length}{" "}
              {filteredPlaces.length === 1
                ? t("places.locale_single")
                : t("places.locales_count")}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          LAYOUT RESPONSIVE SPLIT-VIEW (Desktop 2 columnas, Móvil Mapa + Sheet o Lista completa)
         ========================================================================= */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start pt-0 lg:pt-2">
        {/* Columna Mapa: en desktop siempre visible; en móvil visible arriba cuando activeMobileView === "map" */}
        <div
          className={`w-full lg:col-span-7 xl:col-span-7 lg:order-2 ${activeMobileView === "list" ? "hidden lg:block" : "block order-1"
            }`}
        >
          <div className="lg:sticky lg:top-4 space-y-2 pb-0">
            <div className="rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-lg lg:shadow-xl dark:shadow-2xl">
              <MapContainerWrapper
                places={filteredPlaces}
                selectedPlaceId={selectedPlaceId}
                onSelectPlace={handleSelectPlaceFromMap}
                userLocation={userLocation}
                radiusKm={radiusKm}
                occasionMap={occasionMap}
                isFiltered={isFiltered}
                className="w-full h-[44vh] min-h-[300px] sm:h-[460px] lg:h-[calc(100vh-12rem)] lg:min-h-[380px]"
              />
            </div>
          </div>
        </div>

        {/* Columna Lista de Tarjetas: en desktop siempre visible; en móvil Bottom Sheet bajo el mapa o lista completa */}
        <div
          id="places-list-top"
          className={`space-y-3.5 lg:col-span-5 xl:col-span-5 lg:order-1 order-2 w-full ${activeMobileView === "map"
            ? "-mt-5 relative z-[450] rounded-t-[28px] bg-white dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-10px_28px_rgba(15,23,42,0.10)] px-3 pt-3 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:mt-0 lg:z-auto lg:rounded-none lg:bg-transparent lg:dark:bg-transparent lg:border-0 lg:shadow-none lg:p-0"
            : "pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0"
            }`}
        >
          {/* Tirador superior y cabecera Stitch del Bottom Sheet en móvil */}
          {activeMobileView === "map" && (
            <div className="lg:hidden space-y-2.5 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto" />
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                    {isFiltered ? t("mobile_nav.filtered_title") : t("mobile_nav.featured_title")}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {t("mobile_nav.recommendations_count", { count: filteredPlaces.length })}
                  </p>
                </div>

                <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 shrink-0">
                  <span className="material-symbols-outlined text-sm text-orange-600 leading-none">
                    sort
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="bg-transparent focus:outline-none cursor-pointer font-bold max-w-[130px] truncate"
                    aria-label={t("places.sort_by")}
                  >
                    <option value="recent">{t("places.sort_recent")}</option>
                    <option value="for_you">{t("places.sort_for_you")}</option>
                    {userLocation && <option value="distance">{t("places.sort_distance")}</option>}
                    <option value="rating">{t("places.sort_rating")}</option>
                    <option value="name">{t("places.sort_alphabetical")}</option>
                    <option value="price_asc">{t("places.sort_price_asc")}</option>
                    <option value="price_desc">{t("places.sort_price_desc")}</option>
                  </select>
                </label>
              </div>
            </div>
          )}
          {filteredPlaces.length === 0 ? (
            <div className="p-8 sm:p-10 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/70 dark:bg-slate-900/30 backdrop-blur-xs gm-list-item-in">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-2xl leading-none">search_off</span>
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                {t("places.no_results")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs mx-auto">
                {t("places.no_results_hint")}
              </p>

              {/* Chips clicables para quitar solo un filtro activo */}
              {activeFiltersCount > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-400">
                    {t("places.active_filters_remove_hint")}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {textSearch.trim() && (
                      <button
                        type="button"
                        onClick={() => setTextSearch("")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 text-[11px] font-bold hover:bg-orange-100 transition active:scale-95 cursor-pointer"
                      >
                        <span>«{textSearch.trim()}»</span>
                        <span className="material-symbols-outlined text-xs leading-none">close</span>
                      </button>
                    )}
                    {experienceFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setExperienceFilter("all")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 text-[11px] font-bold hover:bg-orange-100 transition active:scale-95 cursor-pointer"
                      >
                        <span>
                          {experienceFilter === "favorite"
                            ? t("places.favorites")
                            : experienceFilter === "visited_by_me"
                              ? t("places.visited")
                              : experienceFilter === "pending"
                                ? t("places.want_to_go")
                                : t("places.unexplored")}
                        </span>
                        <span className="material-symbols-outlined text-xs leading-none">close</span>
                      </button>
                    )}
                    {selectedCountries.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCountry(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 text-[11px] font-bold hover:bg-orange-100 transition active:scale-95 cursor-pointer"
                      >
                        <span>{c}</span>
                        <span className="material-symbols-outlined text-xs leading-none">close</span>
                      </button>
                    ))}
                    {selectedCities.map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => toggleCity(city)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 text-[11px] font-bold hover:bg-orange-100 transition active:scale-95 cursor-pointer"
                      >
                        <span>{city}</span>
                        <span className="material-symbols-outlined text-xs leading-none">close</span>
                      </button>
                    ))}
                    {selectedTowns.map((tw) => (
                      <button
                        key={tw}
                        type="button"
                        onClick={() => toggleTown(tw)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 text-[11px] font-bold hover:bg-orange-100 transition active:scale-95 cursor-pointer"
                      >
                        <span>{tw}</span>
                        <span className="material-symbols-outlined text-xs leading-none">close</span>
                      </button>
                    ))}
                    {minRating !== null && (
                      <button
                        type="button"
                        onClick={() => setMinRating(null)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 text-[11px] font-bold hover:bg-amber-100 transition active:scale-95 cursor-pointer"
                      >
                        <span>★ {minRating}+</span>
                        <span className="material-symbols-outlined text-xs leading-none">close</span>
                      </button>
                    )}
                    {selectedFriendIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedFriendIds([])}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 text-[11px] font-bold hover:bg-orange-100 transition active:scale-95 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-xs leading-none">diversity_3</span>
                        <span>
                          {t("friends_filter.chip_label", { count: selectedFriendIds.length })}
                        </span>
                        <span className="material-symbols-outlined text-xs leading-none">close</span>
                      </button>
                    )}
                    {selectedPrices.map((pr) => (
                      <button
                        key={pr}
                        type="button"
                        onClick={() => togglePrice(pr)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 text-[11px] font-bold hover:bg-orange-100 transition active:scale-95 cursor-pointer"
                      >
                        <span>{pr}</span>
                        <span className="material-symbols-outlined text-xs leading-none">close</span>
                      </button>
                    ))}
                    {selectedOccasions.map((occId) => (
                      <button
                        key={occId}
                        type="button"
                        onClick={() => toggleOccasion(occId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 text-[11px] font-bold hover:bg-orange-100 transition active:scale-95 cursor-pointer"
                      >
                        <span>{occasionMap[occId]?.name || occId}</span>
                        <span className="material-symbols-outlined text-xs leading-none">close</span>
                      </button>
                    ))}
                    {selectedTags.map((tg) => (
                      <button
                        key={tg}
                        type="button"
                        onClick={() => toggleTag(tg)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 text-[11px] font-bold hover:bg-orange-100 transition active:scale-95 cursor-pointer"
                      >
                        <span>#{tg}</span>
                        <span className="material-symbols-outlined text-xs leading-none">close</span>
                      </button>
                    ))}
                    {userLocation && (
                      <button
                        type="button"
                        onClick={handleDisableLocation}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 text-[11px] font-bold hover:bg-blue-100 transition active:scale-95 cursor-pointer"
                      >
                        <span>{t("places.location_active")}</span>
                        <span className="material-symbols-outlined text-xs leading-none">close</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition active:scale-95 cursor-pointer"
              >
                {t("places.reset_filters")}
              </button>
            </div>
          ) : (
            <div className="space-y-3.5 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1 no-scrollbar pb-4 lg:pb-0">
              <div
                className={`${activeMobileView === "map" ? "hidden lg:flex" : "flex"
                  } items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium px-1 flex-wrap`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-orange-600 text-sm">
                    {filteredPlaces.length} {filteredPlaces.length === 1 ? t("places.locale_single") : t("places.locales_count")}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#ffddb8] text-[#684000] text-xs font-bold shadow-2xs">
                    {t("places.page_of", { current: currentPage, total: totalPages })}
                  </span>
                  {textSearch && <span className="hidden sm:inline text-slate-400 text-xs">• «{textSearch}»</span>}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="hidden sm:inline">{t("places.page_size")}:</span>
                    <CustomSelect
                      value={String(pageSize)}
                      onChange={(val) => {
                        setPageSize(Number(val));
                        setCurrentPage(1);
                      }}
                      ariaLabel={t("places.page_size")}
                      options={[
                        { value: "10", label: `10 ${t("places.per_page")}` },
                        { value: "20", label: `20 ${t("places.per_page")}` },
                        { value: "50", label: `50 ${t("places.per_page")}` },
                        { value: "10000", label: t("places.all") },
                      ]}
                    />
                  </div>

                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="hidden sm:inline">{t("places.sort_by")}:</span>
                    <CustomSelect
                      value={sortBy}
                      onChange={(val) => setSortBy(val as typeof sortBy)}
                      ariaLabel={t("places.sort_by")}
                      options={[
                        {
                          value: "recent",
                          label: t("places.sort_recent"),
                          icon: (
                            <span className="material-symbols-outlined text-[15px] text-orange-600 dark:text-orange-400 leading-none">
                              schedule
                            </span>
                          ),
                        },
                        {
                          value: "for_you",
                          label: t("places.sort_for_you"),
                          icon: (
                            <span className="material-symbols-outlined text-[15px] text-indigo-600 dark:text-indigo-400 leading-none">
                              auto_awesome
                            </span>
                          ),
                        },
                        ...(userLocation
                          ? [
                            {
                              value: "distance" as const,
                              label: t("places.sort_distance"),
                              icon: (
                                <span className="material-symbols-outlined text-[15px] text-blue-600 dark:text-blue-400 leading-none">
                                  near_me
                                </span>
                              ),
                            },
                          ]
                          : []),
                        {
                          value: "rating",
                          label: t("places.sort_rating"),
                          icon: (
                            <span className="material-symbols-outlined text-[15px] text-amber-500 leading-none">
                              star
                            </span>
                          ),
                        },
                        {
                          value: "name",
                          label: t("places.sort_alphabetical"),
                          icon: (
                            <span className="material-symbols-outlined text-[15px] text-slate-500 dark:text-slate-400 leading-none">
                              sort_by_alpha
                            </span>
                          ),
                        },
                        {
                          value: "price_asc",
                          label: t("places.sort_price_asc"),
                          icon: (
                            <span className="material-symbols-outlined text-[15px] text-emerald-600 dark:text-emerald-400 leading-none">
                              savings
                            </span>
                          ),
                        },
                        {
                          value: "price_desc",
                          label: t("places.sort_price_desc"),
                          icon: (
                            <span className="material-symbols-outlined text-[15px] text-purple-600 dark:text-purple-400 leading-none">
                              diamond
                            </span>
                          ),
                        },
                      ] as Array<CustomSelectOption<typeof sortBy>>}
                    />
                  </div>
                </div>
              </div>

              {sortBy === "for_you" && (
                <div className="px-3.5 py-2.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 flex flex-wrap items-center gap-1.5 text-[11px] text-indigo-800 dark:text-indigo-200">
                  <span className="material-symbols-outlined text-sm text-indigo-600 dark:text-indigo-400 leading-none">
                    auto_awesome
                  </span>
                  {tasteProfile.hasSignals ? (
                    <>
                      <span className="font-bold">{t("places.for_you_banner")}</span>
                      {tasteSummary.topOccasionIds.map((occId) => (
                        <span
                          key={occId}
                          className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/70 border border-indigo-200/60 dark:border-indigo-800 font-semibold"
                        >
                          {occasionMap[occId]?.name || occId}
                        </span>
                      ))}
                      {tasteSummary.topTags.map((tg) => (
                        <span
                          key={tg}
                          className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/70 border border-indigo-200/60 dark:border-indigo-800 font-semibold"
                        >
                          #{tg}
                        </span>
                      ))}
                      {tasteSummary.topPrice && (
                        <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/70 border border-indigo-200/60 dark:border-indigo-800 font-semibold">
                          {tasteSummary.topPrice}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="font-medium">{t("places.for_you_empty_hint")}</span>
                  )}
                </div>
              )}

              {/* Tarjetas paginadas con entrada escalonada sutil */}
              {paginatedPlaces.map((place, idx) => (
                <div
                  key={`${place.id}-p${currentPage}`}
                  className="gm-list-item-in"
                  style={{ animationDelay: `${Math.min(idx, 5) * 28}ms` }}
                >
                  <PlaceCard
                    place={place}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    isSpaceAdmin={isSpaceAdmin}
                    availableSpaces={availableSpaces}
                    showSpaceBadge={workspaceMode === "all"}
                    occasionMap={occasionMap}
                    occasionsList={occasionsList}
                    availableTags={availableTagNames}
                    onSelectPlaceId={handleSelectOnMap}
                    isCompared={compareIds.includes(place.id)}
                    onToggleCompareId={toggleComparePlace}
                    onPersonalUpdate={handlePersonalUpdate}
                    isSelected={selectedPlaceId === place.id}
                  />
                </div>
              ))}

              {/* Barra de Paginación Moderna estilo Stitch */}
              {(totalPages > 1 || filteredPlaces.length > 10) && (
                <nav className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 px-3 sm:px-3.5 py-2 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800/70 mt-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    aria-label={t("places.previous")}
                    className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">chevron_left</span>
                    <span className="hidden sm:inline">{t("places.previous")}</span>
                  </button>

                  <span className="sm:hidden px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-extrabold whitespace-nowrap">
                    {currentPage} / {totalPages}
                  </span>

                  <div className="hidden sm:flex items-center gap-1 font-semibold text-xs">
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
                              className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center transition cursor-pointer ${currentPage === p
                                ? "bg-orange-600 text-white shadow-xs"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
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
                    aria-label={t("places.next")}
                    className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-900 dark:text-orange-200 text-xs font-bold hover:bg-orange-200 dark:hover:bg-orange-900/60 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer shrink-0"
                  >
                    <span className="hidden sm:inline">{t("places.next")}</span>
                    <span className="material-symbols-outlined text-sm leading-none">chevron_right</span>
                  </button>
                </nav>
              )}
            </div>
          )}
        </div>

        {/* Fin layout */}
      </div>

      {/* Barra flotante del Comparador de Establecimientos (hasta 3 sitios) */}
      {compareIds.length > 0 && !(selectedPlace && activeMobileView === "map") && (
        <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-5 left-1/2 -translate-x-1/2 z-[955] max-w-[calc(100vw-1.5rem)]">
          <div className="gm-slide-up inline-flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-2.5 rounded-full bg-slate-900/95 dark:bg-slate-900 text-white border border-amber-500/40 shadow-2xl backdrop-blur-md">
            <span className="text-xs font-bold flex items-center gap-1.5 whitespace-nowrap min-w-0">
              <span className="material-symbols-outlined text-base text-orange-400 leading-none shrink-0">compare_arrows</span>
              <span className="truncate">{t("places.compare_counter", { count: compareIds.length })}</span>
            </span>
            <button
              type="button"
              onClick={() => setIsCompareOpen(true)}
              disabled={compareIds.length < 2}
              className="px-3 py-1 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              {t("places.open_compare")}
            </button>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs text-slate-400 hover:text-red-400 font-bold p-1 cursor-pointer shrink-0 leading-none"
              title={t("places.clear_compare_tooltip")}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Modales Interactivos cargados bajo demanda (code-splitting + lazy mount) */}
      {isRandomModalOpen && (
        <RandomPickerModal
          isOpen={isRandomModalOpen}
          onClose={() => setIsRandomModalOpen(false)}
          places={filteredPlaces}
          onSelectOnMap={(id) => handleSelectOnMap(id)}
          onSelectInList={(id) => handleSelectInList(id)}
        />
      )}

      {isAssistantOpen && (
        <DecisionAssistantModal
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
          occasions={occasionsList}
          selectedOccasions={selectedOccasions}
          onSelectOccasions={(occs) => setSelectedOccasions(occs)}
          tags={sortedTags}
          selectedTags={selectedTags}
          onSelectTags={(tgs) => setSelectedTags(tgs)}
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
          countries={countryOptions}
          selectedCountries={selectedCountries}
          onSelectCountries={(vals) => {
            setSelectedCountries(vals);
            setSelectedCities([]);
            setSelectedTowns([]);
          }}
          cities={cityOptions}
          selectedCities={selectedCities}
          onSelectCities={(vals) => {
            setSelectedCities(vals);
            setSelectedTowns([]);
          }}
          towns={townOptions}
          selectedTowns={selectedTowns}
          onSelectTowns={(vals) => setSelectedTowns(vals)}
          minRating={minRating}
          onSelectMinRating={(val) => setMinRating(val)}
          friendOptions={friendSelectOptions}
          selectedFriendIds={selectedFriendIds}
          onSelectFriends={setSelectedFriendIds}
          friendsFilterMode={friendsFilterMode}
          onChangeFriendsFilterMode={setFriendsFilterMode}
          includeMeWithFriends={includeMeWithFriends}
          onToggleIncludeMeWithFriends={setIncludeMeWithFriends}
          spaces={workspaceMode === "all" ? availableSpaces : []}
          selectedSpaceIds={selectedSpaceFilterIds}
          onToggleSpace={(sid) =>
            setSelectedSpaceFilterIds((prev) =>
              prev.includes(sid) ? prev.filter((id) => id !== sid) : [...prev, sid]
            )
          }
          matchingCount={filteredPlaces.length}
          onReset={resetAllFilters}
        />
      )}

      {isExportImportOpen && (
        <ExportImportModal
          isOpen={isExportImportOpen}
          onClose={() => setIsExportImportOpen(false)}
          places={filteredPlaces}
        />
      )}

      {isBulkAddListOpen && (
        <BulkAddToListModal
          isOpen={isBulkAddListOpen}
          onClose={() => setIsBulkAddListOpen(false)}
          places={filteredPlaces}
          suggestedListName={selectedCities.length === 1 ? selectedCities[0] : ""}
          activeFilterCriteria={{
            textSearch,
            selectedCountries,
            selectedCities,
            selectedTowns,
            selectedOccasions,
            selectedTags,
            selectedPrices,
          }}
        />
      )}

      {isCompareOpen && (
        <ComparePlacesModal
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          places={placesData.filter((p) => compareIds.includes(p.id))}
          occasionMap={occasionMap}
          onRemovePlace={(id) => toggleComparePlace(id)}
          onSelectOnMap={handleSelectOnMap}
          onClearAll={() => {
            setCompareIds([]);
            setIsCompareOpen(false);
          }}
        />
      )}

      {isCommandPaletteOpen && (
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          places={placesData}
          isAdmin={isAdmin}
          onSelectPlaceOnMap={handleSelectOnMap}
          onSelectPlaceInList={handleSelectInList}
          onOpenRandom={() => setIsRandomModalOpen(true)}
          onOpenAssistant={() => setIsAssistantOpen(true)}
          onOpenExportImport={() => setIsExportImportOpen(true)}
        />
      )}

      {/* Opción 7: Tarjeta flotante inferior en móvil con sitio seleccionado en el mapa */}
      {selectedPlace && activeMobileView === "map" && (
        <div className="lg:hidden fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-[955] p-4 rounded-3xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-md gm-slide-up">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  {selectedPlace.priceRange}
                </span>
                {selectedPlace.isFavorite && (
                  <span className="material-symbols-outlined text-sm text-amber-500 leading-none">star</span>
                )}
                <span className="text-xs font-bold text-slate-500 truncate">
                  {selectedPlace.city || ""}
                </span>
              </div>
              <h4 className="font-black text-slate-900 dark:text-slate-100 text-sm mt-1 truncate">
                {selectedPlace.name}
              </h4>
              {selectedPlace.address && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-orange-600 leading-none shrink-0">location_on</span>
                  <span className="truncate">{selectedPlace.address}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedPlaceId(null)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              aria-label={t("common.close")}
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
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-center border border-blue-200 dark:border-blue-900/40"
              >
                <span className="material-symbols-outlined text-sm leading-none">directions</span>
                <span>{t("places.get_directions")}</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                const placeId = selectedPlace.id;
                // 1. Calcular en qué página de resultados se encuentra este lugar
                const placeIndex = filteredPlaces.findIndex((p) => p.id === placeId);
                if (placeIndex !== -1) {
                  const targetPage = Math.floor(placeIndex / pageSize) + 1;
                  if (targetPage !== currentPage) {
                    setCurrentPage(targetPage);
                  }
                }

                // 2. Cambiar de vista a "list"
                setActiveMobileView("list");

                // 3. Scroll suave hacia la tarjeta específica
                const scrollToCard = () => {
                  const el = document.getElementById(`place-card-${placeId}`);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                };

                setTimeout(scrollToCard, 50);
                setTimeout(scrollToCard, 150);
                setTimeout(scrollToCard, 350);
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-center shadow-sm cursor-pointer"
            >
              {t("places.view_details")}
            </button>
          </div>
        </div>
      )}

      {/* FAB flotante «Añadir sitio» estilo Stitch en móvil (oculto si hay tarjeta seleccionada, comparador o filtros abiertos) */}
      {!selectedPlace && !showExtraFilters && !isAssistantOpen && compareIds.length === 0 && (
        <a
          href="/new"
          className="lg:hidden fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-[950] inline-flex items-center gap-1.5 px-4 py-3 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-lg shadow-orange-600/35 active:scale-95 transition"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">add_location_alt</span>
          <span>{t("places.add_new")}</span>
        </a>
      )}

      {/* Barra de navegación inferior fija móvil estilo Stitch */}
      <MobileBottomNav onExploreClick={() => setActiveMobileView("map")} />

      {/* Botón flotante para subir arriba: en móvil solo en vista lista y si no hay tarjeta abierta */}
      <ScrollToTop
        className={activeMobileView === "map" || Boolean(selectedPlace) ? "hidden lg:flex" : "flex"}
      />
    </div>
  );
}
