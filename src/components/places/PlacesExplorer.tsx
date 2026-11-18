"use client";

import { useState, useMemo } from "react";
import { PlaceCard } from "./PlaceCard";
import { MapContainerWrapper } from "@/components/map/MapContainerWrapper";
import type { PlaceWithDetails } from "@/lib/actions/places";

interface PlacesExplorerProps {
  initialPlaces: PlaceWithDetails[];
  occasionsList: { id: string; name: string; icon: string }[];
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
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // Geolocalización
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);

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

    // 1. Filtro por Ocasión
    if (selectedOccasion) {
      result = result.filter((p) => p.occasions.includes(selectedOccasion));
    }

    // 2. Filtro por Etiqueta
    if (selectedTag) {
      result = result.filter((p) => p.tags.includes(selectedTag));
    }

    // 3. Filtro por Radio en Km
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
  }, [initialPlaces, selectedOccasion, selectedTag, userLocation, radiusKm]);

  // Manejar clic en "Ver en mapa" desde una tarjeta
  function handleSelectOnMap(placeId: string) {
    setSelectedPlaceId(placeId);
    setActiveMobileView("map");
    // En móvil desplazar suavemente al mapa
    if (window.innerWidth < 1024) {
      window.scrollTo({ top: 120, behavior: "smooth" });
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Barra superior de controles: Filtros y Selector de Vista en móvil */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Toggle de Vista SOLO en móvil */}
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 self-start sm:self-auto lg:hidden">
          <button
            type="button"
            onClick={() => setActiveMobileView("map")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeMobileView === "map"
                ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>🗺️</span>
            <span>Mapa</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileView("list")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeMobileView === "list"
                ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>📋</span>
            <span>Lista</span>
            <span className="text-[10px] opacity-75 font-normal">({filteredPlaces.length})</span>
          </button>
        </div>

        {/* Indicador de sitios en desktop */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span>Mostrando <strong>{filteredPlaces.length}</strong> de {initialPlaces.length} locales</span>
        </div>

        {/* Botón Geolocalización «Cerca de mí» */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!userLocation ? (
            <button
              type="button"
              onClick={handleRequestLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <span>{isLocating ? "⏳" : "📍"}</span>
              <span>{isLocating ? "Localizando..." : "Cerca de mí"}</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span>Ubicación activa</span>
              <button
                type="button"
                onClick={handleDisableLocation}
                className="ml-1 text-slate-400 hover:text-red-500 cursor-pointer font-bold text-xs"
                title="Desactivar ubicación"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {locationError && (
        <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
          <span>⚠️ {locationError}</span>
          <button
            onClick={() => setLocationError(null)}
            className="text-xs font-bold text-red-500 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Selector de Radio (cuando Cerca de mí está activo) */}
      {userLocation && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-[11px] font-bold text-slate-400 shrink-0">Radio:</span>
          {[
            { label: "Todo", val: null },
            { label: "1 km", val: 1 },
            { label: "2 km", val: 2 },
            { label: "5 km", val: 5 },
            { label: "10 km", val: 10 },
          ].map((r) => {
            const isSelected = radiusKm === r.val;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => setRadiusKm(r.val)}
                className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition cursor-pointer text-xs ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Filtros Horizontales por Categorías / Ocasiones (sin barra de scroll visible) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedOccasion(null)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
            selectedOccasion === null
              ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs"
              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          🍽️ Todos
        </button>
        {occasionsList.map((occ) => {
          const isSelected = selectedOccasion === occ.id;
          return (
            <button
              key={occ.id}
              type="button"
              onClick={() => setSelectedOccasion(isSelected ? null : occ.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700/50"
              }`}
            >
              <span>{occ.icon}</span>
              <span>{occ.name}</span>
            </button>
          );
        })}
      </div>

      {/* Filtro por Etiquetas Populares */}
      {tagsList.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-[11px] text-slate-400 font-semibold shrink-0">Etiquetas:</span>
          {tagsList.slice(0, 10).map((t) => {
            const isSelected = selectedTag === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTag(isSelected ? null : t.id)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0 transition cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800/80 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                #{t.name}
              </button>
            );
          })}
          {selectedTag && (
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className="text-[11px] text-red-500 font-bold px-1 hover:underline cursor-pointer shrink-0"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          LAYOUT RESPONSIVE PRO:
          - En Móvil (< lg): muestra Mapa O Lista según el toggle activeMobileView.
          - En Desktop (>= lg): Split-view a 2 columnas con Lista a la izquierda
            y Mapa sticky a la derecha.
         ========================================================================= */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start pt-2">
        {/* Columna Izquierda: Lista de Tarjetas */}
        <div className={`space-y-3 lg:col-span-5 xl:col-span-5 ${
          activeMobileView === "map" ? "hidden lg:block" : "block"
        }`}>
          {filteredPlaces.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="text-3xl mb-2">🔍</div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                No se encontraron locales
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 max-w-xs mx-auto">
                No hay resultados con los filtros o el radio de distancia actual.
              </p>
              {(selectedOccasion || selectedTag || radiusKm) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOccasion(null);
                    setSelectedTag(null);
                    setRadiusKm(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition cursor-pointer"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1 no-scrollbar">
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
        <div className={`lg:col-span-7 xl:col-span-7 ${
          activeMobileView === "list" ? "hidden lg:block" : "block"
        }`}>
          <div className="lg:sticky lg:top-4 space-y-2">
            <MapContainerWrapper
              places={filteredPlaces}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={(id) => setSelectedPlaceId(id)}
              userLocation={userLocation}
              radiusKm={radiusKm}
              occasionMap={occasionMap}
              cartoApiKey={cartoApiKey}
              className="w-full h-[65vh] sm:h-[520px] lg:h-[calc(100vh-14rem)] min-h-[420px]"
            />
            <p className="text-[11px] text-slate-400 text-center">
              Mostrando {filteredPlaces.filter((p) => p.latitude != null).length} locales con ubicación geográfica.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
