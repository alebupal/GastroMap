"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
import { parseCityCountry, findCountry } from "@/lib/location";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ScrollToTop } from "@/components/ui/ScrollToTop";

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
  const { t, locale } = useT();
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
  const [showExtraFilters, setShowExtraFilters] = useState(false);

  // Grupos privados
  const [myGroups, setMyGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [mounted, setMounted] = useState(false);
  const [selectedGroupFilterIds, setSelectedGroupFilterIds] = useState<string[]>([]);
  const [isGroupFilterOpen, setIsGroupFilterOpen] = useState(false);
  const groupBtnRef = useRef<HTMLButtonElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const [groupCoords, setGroupCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Posicionar menú emergente de grupos con coordenadas fijas (evita cortes de overflow-x)
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
    if (!isGroupFilterOpen) return;

    updateGroupCoords();
    window.addEventListener("scroll", updateGroupCoords, true);
    window.addEventListener("resize", updateGroupCoords);
    return () => {
      window.removeEventListener("scroll", updateGroupCoords, true);
      window.removeEventListener("resize", updateGroupCoords);
    };
  }, [isGroupFilterOpen]);

  // Cerrar popover de grupos al hacer clic fuera o pulsar Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        groupBtnRef.current &&
        !groupBtnRef.current.contains(target) &&
        groupMenuRef.current &&
        !groupMenuRef.current.contains(target)
      ) {
        setIsGroupFilterOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsGroupFilterOpen(false);
      }
    }
    if (isGroupFilterOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isGroupFilterOpen]);

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
    "all" | "visited_by_me" | "untried" | "favorite" | "pending"
  >("all");

  // Registro PWA Service Worker y caché offline de favoritos / pendientes
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { });
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
      .catch(() => { });
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
      };
    });
  }, [allCountries, locale]);

  const cityOptions = useMemo(() => {
    return availableCities.map((city) => ({
      value: city,
      label: city,
      icon: "📍",
    }));
  }, [availableCities]);

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

    // 0. Búsqueda por texto libre universal (nombre, ciudad, dirección, notas, notas privadas, tags, ocasiones, autor y comentarios)
    if (textSearch.trim().length > 0) {
      const q = textSearch.toLowerCase().trim();
      const tokens = q.split(/\s+/).filter(Boolean);
      result = result.filter((p) => {
        const searchableText = [
          p.name,
          p.city || "",
          p.address || "",
          p.notes || "",
          p.privateNotes || "",
          p.createdByName || "",
          p.createdByUsername || "",
          ...p.tags,
          ...p.occasions,
          ...(p.commentsTexts || []),
          ...(p.sharedGroupNames || []),
        ]
          .join(" ")
          .toLowerCase();

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

  const isFiltered = activeFiltersCount > 0 || selectedGroupFilterIds.length > 0 || radiusKm != null;

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
          1. HERO ACTION HUB: Búsqueda interactiva y botones de acción rápida estilo Stitch
         ========================================================================= */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-2 sm:px-3 border border-slate-200/70 dark:border-slate-800/70">
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
                title="Limpiar búsqueda"
              >
                <span className="material-symbols-outlined text-sm leading-none">close</span>
              </button>
            )}
          </div>

          {/* Acciones Rápidas en píldoras horizontales */}
          <div className="flex items-center gap-1.5 w-full md:w-auto shrink-0 justify-between md:justify-start overflow-x-auto">
            {/* Asistente */}
            <button
              type="button"
              onClick={() => setIsAssistantOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer"
              title="Asistente"
            >
              <span className="material-symbols-outlined text-orange-600 text-base leading-none">assistant</span>
              <span className="hidden sm:inline">{t("places.assistant")}</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-orange-600 text-white text-[10px] ml-0.5 font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

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
                <span className="hidden sm:inline">{isLocating ? "Localizando..." : t("places.near_me")}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold shrink-0">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="text-xs">Ubicación activa</span>
                <button
                  type="button"
                  onClick={handleDisableLocation}
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
          2. TAXONOMÍAS, FILTROS Y ESTADOS: Fila 1 y Fila 2 estilo Stitch
         ========================================================================= */}
      <section className="flex flex-col gap-2.5 bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800/70">
        {/* Fila 1: Píldoras de Experiencia / Colección + Filtros Guardados */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-2">
          <div className="flex items-center gap-1 bg-[#f2f3ff] dark:bg-slate-800/70 p-0.5 rounded-full overflow-x-auto scrollbar-none text-xs font-semibold">
            {[
              { key: "all", icon: null, iconClass: "", label: `Todos (${initialPlaces.length})` },
              { key: "favorite", icon: "star", iconClass: "text-amber-500", label: `Favoritos (${initialPlaces.filter(p => p.isFavorite).length})` },
              { key: "pending", icon: "schedule", iconClass: "text-orange-600 dark:text-orange-400", label: `Quiero ir (${initialPlaces.filter(p => p.personalStatus === "pending").length})` },
              { key: "visited_by_me", icon: "check_circle", iconClass: "text-emerald-600 dark:text-emerald-400", label: `Ya he ido (${initialPlaces.filter(p => p.personalStatus === "visited" || (p.rating !== null && (p.rating ?? 0) > 0)).length})` },
              { key: "untried", icon: "auto_awesome", iconClass: "text-amber-600 dark:text-amber-400", label: "Por descubrir" },
            ].map((item) => {
              const active = experienceFilter === item.key;
              const isUntried = item.key === "untried";
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setExperienceFilter(active && item.key !== "all" ? "all" : (item.key as typeof experienceFilter));
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
                    active
                      ? isUntried
                        ? "bg-[#ffddb8] text-[#684000] font-black shadow-xs"
                        : "bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-xs"
                      : isUntried
                      ? "text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/40 hover:bg-amber-200/60 font-semibold"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold"
                  }`}
                >
                  {item.icon && (
                    <span
                      className={`material-symbols-outlined text-[15px] leading-none ${
                        active && !isUntried ? "text-current" : item.iconClass
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
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-sm text-emerald-600 leading-none">filter_alt</span>
                <span className="font-semibold truncate max-w-[150px]">Filtro activo ({activeFiltersCount})</span>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="text-slate-400 hover:text-red-500 font-bold ml-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
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
            {/* Filtro por Grupos Privados */}
            {myGroups.length > 0 && (
              <div className="relative shrink-0">
                <button
                  ref={groupBtnRef}
                  type="button"
                  onClick={() => {
                    if (!isGroupFilterOpen) {
                      updateGroupCoords();
                      setIsGroupFilterOpen(true);
                    } else {
                      setIsGroupFilterOpen(false);
                    }
                  }}
                  className={`px-3 py-1 rounded-full font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer text-xs border ${selectedGroupFilterIds.length > 0
                    ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                    : "bg-[#f2f3ff] dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                >
                  <span className="material-symbols-outlined text-[15px] leading-none text-orange-600">
                    group
                  </span>
                  <span>
                    {selectedGroupFilterIds.length === 0
                      ? t("places.groups_filter")
                      : selectedGroupFilterIds.length === 1
                        ? myGroups.find((g) => g.id === selectedGroupFilterIds[0])?.name || t("places.group_count_single")
                        : t("places.group_count_multiple", { count: selectedGroupFilterIds.length })}
                  </span>
                  <span className="text-[10px]">{isGroupFilterOpen ? "▲" : "▼"}</span>
                </button>

                {mounted && isGroupFilterOpen && groupCoords &&
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
                              className={`w-full px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${isSelected
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
                    </div>,
                    document.body
                  )}
              </div>
            )}

            {/* Ciudad */}
            {availableCities.length > 0 && (
              <SearchableSelect
                value={selectedCity}
                onChange={(val) => {
                  setSelectedCity(val);
                  setCurrentPage(1);
                }}
                options={cityOptions}
                allOption={{
                  value: "all",
                  label: `${t("places.all_cities")} (${availableCities.length})`,
                  icon: (
                    <span className="material-symbols-outlined text-[16px] leading-none text-orange-600 dark:text-orange-400">
                      location_city
                    </span>
                  ),
                }}
                searchPlaceholder={t("location.city_placeholder")}
                className="shrink-0"
              />
            )}

            {/* Países */}
            {allCountries.length > 0 && (
              <SearchableSelect
                value={selectedCountry}
                onChange={(val) => {
                  setSelectedCountry(val);
                  setSelectedCity("all");
                  setCurrentPage(1);
                }}
                options={countryOptions}
                allOption={{
                  value: "all",
                  label: `${t("places.all_countries")} (${allCountries.length})`,
                  icon: (
                    <span className="material-symbols-outlined text-[16px] leading-none text-orange-600 dark:text-orange-400">
                      public
                    </span>
                  ),
                }}
                searchPlaceholder={t("location.country_placeholder")}
                className="shrink-0"
              />
            )}

            {/* Precios */}
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
                  className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition cursor-pointer ${
                    active
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
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? "bg-[#855300] text-white font-bold shadow-xs"
                      : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{occ.icon}</span>
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
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                    isSelectedTag
                      ? "bg-orange-600 text-white font-bold"
                      : "bg-[#f2f3ff] dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  #{tg.name}
                </button>
              );
            })}
          </div>

          {/* Lado derecho: botón + Filtros (despliega Categorías y Etiquetas) */}
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setShowExtraFilters((prev) => !prev)}
              aria-expanded={showExtraFilters}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold transition cursor-pointer ${
                showExtraFilters
                  ? "bg-orange-600 text-white shadow-xs"
                  : "bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              <span className="material-symbols-outlined text-sm leading-none">tune</span>
              <span>{showExtraFilters ? "Ocultar filtros" : "+ Filtros"}</span>
              {selectedOccasions.length + selectedTags.length > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                    showExtraFilters
                      ? "bg-white/25 text-white"
                      : "bg-orange-600 text-white"
                  }`}
                >
                  {selectedOccasions.length + selectedTags.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Panel desplegable de Planes / Categorías y Etiquetas (solo visible al pulsar + Filtros) */}
      {showExtraFilters && (
        <div className="space-y-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/70 p-3 sm:p-4 shadow-xs animate-in fade-in duration-150">
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
                className={`font-semibold transition cursor-pointer flex items-center gap-1 ${isOccasionSearchOpen || occasionSearchQuery ? "text-amber-400" : "text-slate-400 hover:text-slate-200"
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
              className="w-full pl-8 pr-8 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-0 focus:border-slate-400 dark:focus:border-slate-600 transition"
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
                  className="w-full pl-8 pr-8 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-0 focus:border-slate-400 dark:focus:border-slate-600 transition"
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
        </div>
      )}

      {/* =========================================================================
          SELECTOR DE PESTAÑAS MÓVIL SUPERIOR (Opción 2: Tabs limpios integrados)
         ========================================================================= */}
      <div className="lg:hidden pt-1">
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveMobileView("map")}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeMobileView === "map"
              ? "bg-orange-600 text-white shadow-md shadow-orange-600/25"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
          >
            <span className="text-sm leading-none">🗺️</span>
            <span>{t("places.view_map")}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeMobileView === "map"
                ? "bg-slate-950/15 text-slate-950"
                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
            >
              {filteredPlaces.filter((p) => p.latitude != null).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMobileView("list")}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeMobileView === "list"
              ? "bg-orange-600 text-white shadow-md shadow-orange-600/25"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
          >
            <span className="text-sm leading-none">📋</span>
            <span>{t("places.view_list")}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeMobileView === "list"
                ? "bg-slate-950/15 text-slate-950"
                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
            >
              {filteredPlaces.length}
            </span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          LAYOUT RESPONSIVE SPLIT-VIEW (Desktop 2 columnas, Móvil pestañas exclusivas Mapa / Lista)
         ========================================================================= */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start pt-1 lg:pt-2">
        {/* Columna Mapa: en desktop siempre visible; en móvil exclusiva cuando activeMobileView === "map" */}
        <div
          className={`w-full lg:col-span-7 xl:col-span-7 lg:order-2 ${activeMobileView === "list" ? "hidden lg:block" : "block order-1 mb-4 lg:mb-0"
            }`}
        >
          <div className="lg:sticky lg:top-4 space-y-2 pb-2 lg:pb-0">
            <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl">
              <MapContainerWrapper
                places={filteredPlaces}
                selectedPlaceId={selectedPlaceId}
                onSelectPlace={handleSelectPlaceFromMap}
                userLocation={userLocation}
                radiusKm={radiusKm}
                occasionMap={occasionMap}
                cartoApiKey={cartoApiKey}
                isFiltered={isFiltered}
                className="w-full h-[58vh] sm:h-[520px] lg:h-[calc(100vh-14rem)] min-h-[380px]"
              />
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/70 rounded-xl text-xs font-medium">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Base de datos sincronizada localmente (Cache First)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <span>Lat: 37.1773° N</span>
                <span>•</span>
                <span>Lon: 3.5986° W</span>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Lista de Tarjetas: en desktop siempre visible; en móvil exclusiva cuando activeMobileView === "list" */}
        <div
          id="places-list-top"
          className={`space-y-3.5 lg:col-span-5 xl:col-span-5 lg:order-1 order-2 w-full ${activeMobileView === "map" ? "hidden lg:block" : "block"
            }`}
        >
          {filteredPlaces.length === 0 ? (
            <div className="p-10 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/70 dark:bg-slate-900/30 backdrop-blur-xs">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                {t("places.no_results")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs mx-auto">
                {t("places.no_results_hint")}
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
              <div className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium px-1 flex-wrap">
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
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="hidden sm:inline">{t("places.page_size")}:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-0 focus:border-slate-400 dark:focus:border-slate-600 cursor-pointer transition"
                      aria-label={t("places.page_size")}
                    >
                      <option value={10}>10 {t("places.per_page")}</option>
                      <option value={20}>20 {t("places.per_page")}</option>
                      <option value={50}>50 {t("places.per_page")}</option>
                      <option value={10000}>{t("places.all")}</option>
                    </select>
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="hidden sm:inline">{t("places.sort_by")}:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="px-2 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-0 focus:border-slate-400 dark:focus:border-slate-600 cursor-pointer transition"
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
                  isSelected={selectedPlaceId === place.id}
                />
              ))}

              {/* Barra de Paginación Moderna estilo Stitch */}
              {(totalPages > 1 || filteredPlaces.length > 10) && (
                <nav className="flex items-center justify-between bg-white dark:bg-slate-900 px-3.5 py-2 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800/70 mt-2">
                  <button
                    type="button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">chevron_left</span>
                    <span>{t("places.previous")}</span>
                  </button>

                  <div className="flex items-center gap-1 font-semibold text-xs">
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
                              className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center transition cursor-pointer ${
                                currentPage === p
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
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-900 dark:text-orange-200 text-xs font-bold hover:bg-orange-200 dark:hover:bg-orange-900/60 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    <span>{t("places.next")}</span>
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
      {compareIds.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
          <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-slate-900/95 dark:bg-slate-900 text-white border border-amber-500/40 shadow-2xl backdrop-blur-md">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <span>⚖️</span>
              <span>Comparar ({compareIds.length}/3)</span>
            </span>
            <button
              type="button"
              onClick={() => setIsCompareOpen(true)}
              disabled={compareIds.length < 2}
              className="px-3 py-1 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-black text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Abrir
            </button>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              className="text-xs text-slate-400 hover:text-red-400 font-bold px-1 cursor-pointer"
              title={t("places.clear_compare_tooltip")}
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
        onSelectInList={(id) => handleSelectInList(id)}
      />

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
        matchingCount={filteredPlaces.length}
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
        onClearAll={() => {
          setCompareIds([]);
          setIsCompareOpen(false);
        }}
      />

      {/* Opción 7: Tarjeta flotante inferior en móvil con sitio seleccionado en el mapa */}
      {selectedPlace && activeMobileView === "map" && (
        <div className="lg:hidden fixed bottom-4 left-3 right-3 z-50 p-4 rounded-3xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-200">
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
                className="flex-1 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-center border border-blue-200 dark:border-blue-900/40"
              >
                {t("places.get_directions")}
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

      {/* Botón flotante para subir arriba: en móvil solo en vista lista y si no hay tarjeta abierta */}
      <ScrollToTop
        className={activeMobileView === "map" || Boolean(selectedPlace) ? "hidden lg:flex" : "flex"}
      />
    </div>
  );
}
