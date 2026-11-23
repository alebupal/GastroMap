"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  createPlaceMarkerIcon,
  createClusterMarkerIcon,
  createUserLocationIcon,
  type PinPersonalBadge,
} from "@/lib/map-icons";
import { linkifyHtml } from "@/components/ui/LinkifiedText";
import type { PlaceWithDetails } from "@/lib/actions/places";

function getPersonalBadge(place: PlaceWithDetails): PinPersonalBadge {
  if (place.isFavorite) return "favorite";
  if (place.personalStatus === "visited") return "visited";
  if (place.personalStatus === "pending") return "pending";
  return null;
}

interface MapViewProps {
  places: PlaceWithDetails[];
  selectedPlaceId?: string | null;
  onSelectPlace?: (placeId: string | null) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  radiusKm?: number | null;
  occasionMap?: Record<string, { name: string; icon: string }>;
  className?: string;
  cartoApiKey?: string | null;
  isFiltered?: boolean;
}

const SPAIN_CENTER: [number, number] = [40.4168, -3.7038];
const SPAIN_DEFAULT_ZOOM = 6;

const PRICE_RANGE_LABELS: Record<string, string> = {
  "€": "< 15 €",
  "€€": "15 - 30 €",
  "€€€": "30 - 50 €",
  "€€€€": "> 50 €",
  "???": "???",
};

// Función auxiliar para construir el contenido HTML enriquecido del popup estilo Stitch
function getPlacePopupHtml(place: PlaceWithDetails, lat: number, lng: number) {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const initials =
    place.name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "🍴";

  const priceLabel = PRICE_RANGE_LABELS[place.priceRange] || place.priceRange;
  const statusLabel =
    place.personalStatus === "visited"
      ? "✅ Ya he ido"
      : place.personalStatus === "pending"
      ? "🕒 Pendiente"
      : "✨ Por descubrir";

  return `
    <div style="padding: 10px 12px; min-width: 210px; max-width: 250px; font-family: 'Plus Jakarta Sans', system-ui, sans-serif;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="width: 24px; height: 24px; border-radius: 8px; background: #ffdbce; color: #370e00; font-weight: 800; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.06);">${initials}</span>
          <strong style="font-size: 13px; color: #131b2e; font-weight: 700; line-height: 1.2;">${place.name}</strong>
        </div>
        <span style="font-size: 10px; font-weight: 700; color: #005236; background: #6ffbbe; padding: 1px 6px; border-radius: 9999px; white-space: nowrap;">${priceLabel}</span>
      </div>
      ${
        place.city || place.address
          ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #5a4138;">📍 ${place.city ? place.city : ""}${
              place.city && place.address ? " • " : ""
            }${place.address || ""}</p>`
          : ""
      }
      ${
        place.notes
          ? `<p style="margin: 6px 0 0 0; font-size: 11px; color: #475569; font-style: italic; background: #f8fafc; padding: 4px 6px; border-radius: 6px;">«${linkifyHtml(place.notes)}»</p>`
          : ""
      }
      <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #eaedff; display: flex; align-items: center; justify-content: space-between; font-size: 10px;">
        <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="color: #a33900; font-weight: 700; text-decoration: none;">
          Abrir en Maps ↗
        </a>
        <span style="background: #ffddb8; color: #684000; font-weight: 700; padding: 2px 6px; border-radius: 9999px;">${statusLabel}</span>
      </div>
    </div>
  `;
}

export default function MapView({
  places,
  selectedPlaceId,
  onSelectPlace,
  userLocation,
  radiusKm,
  occasionMap = {},
  className = "w-full h-[60vh] sm:h-[500px]",
  cartoApiKey,
  isFiltered = false,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const clusterMarkersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const hasInitializedBoundsRef = useRef(false);
  const lastCenteredIdRef = useRef<string | null>(null);

  // 1. Inicialización única del mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Centro inicial: coordenadas del usuario si existen o España por defecto
    const initialCenter: [number, number] = userLocation
      ? [userLocation.latitude, userLocation.longitude]
      : SPAIN_CENTER;
    const initialZoom = userLocation ? 14 : SPAIN_DEFAULT_ZOOM;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 2,
      worldCopyJump: true,
      zoomControl: true,
      attributionControl: false,
    });

    // Capa de tiles: si el usuario ha configurado Carto API Key usa Voyager, si no OpenStreetMap oficial sin marcas de agua
    const tileUrl = cartoApiKey
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?api_key=${cartoApiKey}`
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: cartoApiKey ? "abcd" : "abc",
    }).addTo(map);

    // Atribución discreta
    L.control
      .attribution({
        position: "bottomright",
        prefix: false,
      })
      .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>')
      .addTo(map);

    mapInstanceRef.current = map;

    // Observador para redimensionamientos del contenedor (ej. cambio pestaña móvil o resize)
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    const markers = markersRef.current;
    return () => {
      resizeObserver.disconnect();
      markers.forEach((marker) => marker.remove());
      markers.clear();
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (radiusCircleRef.current) {
        radiusCircleRef.current.remove();
        radiusCircleRef.current = null;
      }
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Actualizar marcador del usuario y círculo de radio
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userLocation) {
      const userLatLng: [number, number] = [userLocation.latitude, userLocation.longitude];

      if (!userMarkerRef.current || !map.hasLayer(userMarkerRef.current)) {
        if (userMarkerRef.current) userMarkerRef.current.remove();
        userMarkerRef.current = L.marker(userLatLng, {
          icon: createUserLocationIcon(),
          zIndexOffset: 1000,
        })
          .addTo(map)
          .bindPopup("<div class='p-2 font-semibold text-xs text-blue-600'>📍 Tu ubicación actual</div>");
      } else {
        userMarkerRef.current.setLatLng(userLatLng);
      }

      // Círculo de radio si está activado
      if (radiusKm && radiusKm > 0) {
        const radiusMeters = radiusKm * 1000;
        if (!radiusCircleRef.current) {
          radiusCircleRef.current = L.circle(userLatLng, {
            radius: radiusMeters,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.1,
            weight: 1.5,
          }).addTo(map);
        } else {
          radiusCircleRef.current.setLatLng(userLatLng);
          radiusCircleRef.current.setRadius(radiusMeters);
        }
      } else if (radiusCircleRef.current) {
        radiusCircleRef.current.remove();
        radiusCircleRef.current = null;
      }
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (radiusCircleRef.current) {
        radiusCircleRef.current.remove();
        radiusCircleRef.current = null;
      }
    }
  }, [userLocation, radiusKm]);

  // 3. Renderizado de marcadores y clustering dinámico por proximidad en pantalla
  const renderMarkersAndClusters = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Limpiar clústeres previos
    clusterMarkersRef.current.forEach((cm) => cm.remove());
    clusterMarkersRef.current = [];

    // Preparar puntos válidos
    type ValidItem = { place: PlaceWithDetails; lat: number; lng: number };
    const validItems: ValidItem[] = [];
    places.forEach((place) => {
      if (place.latitude == null || place.longitude == null) return;
      const lat =
        typeof place.latitude === "number"
          ? place.latitude
          : parseFloat(String(place.latitude));
      const lng =
        typeof place.longitude === "number"
          ? place.longitude
          : parseFloat(String(place.longitude));
      if (!isNaN(lat) && !isNaN(lng)) {
        validItems.push({ place, lat, lng });
      }
    });

    const zoom = map.getZoom();
    const shouldCluster = zoom < 16 && validItems.length > 1;
    const clusterRadiusPx = 52;

    const singleItems: ValidItem[] = [];
    const clusters: ValidItem[][] = [];

    if (!shouldCluster) {
      singleItems.push(...validItems);
    } else {
      const assigned = new Set<string>();

      // El sitio seleccionado siempre se muestra individualmente (nunca oculto en un clúster)
      if (selectedPlaceId) {
        const selectedItem = validItems.find((i) => i.place.id === selectedPlaceId);
        if (selectedItem) {
          singleItems.push(selectedItem);
          assigned.add(selectedItem.place.id);
        }
      }

      // Agrupación espacial por distancia en píxeles de pantalla
      const pointsCache = new Map<string, L.Point>();
      validItems.forEach((item) => {
        if (!assigned.has(item.place.id)) {
          pointsCache.set(item.place.id, map.latLngToContainerPoint([item.lat, item.lng]));
        }
      });

      for (const item of validItems) {
        if (assigned.has(item.place.id)) continue;
        assigned.add(item.place.id);

        const p1 = pointsCache.get(item.place.id)!;
        const group: ValidItem[] = [item];

        for (const other of validItems) {
          if (assigned.has(other.place.id)) continue;
          const p2 = pointsCache.get(other.place.id)!;
          if (p1.distanceTo(p2) <= clusterRadiusPx) {
            assigned.add(other.place.id);
            group.push(other);
          }
        }

        if (group.length === 1) {
          singleItems.push(group[0]);
        } else {
          clusters.push(group);
        }
      }
    }

    // Eliminar marcadores individuales que ya no son visibles (por filtro o porque entraron en un clúster)
    const visibleSingleIds = new Set(singleItems.map((i) => i.place.id));
    markersRef.current.forEach((marker, id) => {
      if (!visibleSingleIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Pintar marcadores individuales
    singleItems.forEach(({ place, lat, lng }) => {
      const latLng: [number, number] = [lat, lng];
      const isSelected = selectedPlaceId === place.id;
      const primaryOccasion = place.occasions[0];
      const occasionInfo = primaryOccasion ? occasionMap[primaryOccasion] : undefined;
      const badge = getPersonalBadge(place);
      const icon = createPlaceMarkerIcon(primaryOccasion, occasionInfo?.icon, isSelected, badge);
      const popupHtml = getPlacePopupHtml(place, lat, lng);

      let marker = markersRef.current.get(place.id);
      if (!marker || !map.hasLayer(marker)) {
        if (marker) marker.remove();
        marker = L.marker(latLng, {
          icon,
          zIndexOffset: isSelected ? 500 : 100,
        })
          .addTo(map)
          .bindPopup(popupHtml)
          .on("click", () => {
            if (onSelectPlace) onSelectPlace(place.id);
          });
        markersRef.current.set(place.id, marker);
      } else {
        marker.setLatLng(latLng);
        marker.setIcon(icon);
        marker.setZIndexOffset(isSelected ? 500 : 100);
        marker.setPopupContent(popupHtml);
      }

      if (isSelected) {
        marker.openPopup();
      }
    });

    // Pintar marcadores de clúster
    clusters.forEach((group) => {
      const avgLat = group.reduce((acc, i) => acc + i.lat, 0) / group.length;
      const avgLng = group.reduce((acc, i) => acc + i.lng, 0) / group.length;
      const clusterIcon = createClusterMarkerIcon(group.length);

      const clusterMarker = L.marker([avgLat, avgLng], {
        icon: clusterIcon,
        zIndexOffset: 250,
      })
        .addTo(map)
        .on("click", () => {
          const groupBounds = L.latLngBounds(
            group.map((i) => [i.lat, i.lng] as [number, number])
          );
          if (groupBounds.getNorthEast().equals(groupBounds.getSouthWest())) {
            map.setView([avgLat, avgLng], Math.min(map.getZoom() + 2, 17));
          } else {
            map.fitBounds(groupBounds, { padding: [55, 55], maxZoom: 16 });
          }
        });

      clusterMarkersRef.current.push(clusterMarker);
    });
  }, [places, selectedPlaceId, occasionMap, onSelectPlace]);

  // 3b. Encuadrar vista inicial y re-renderizar marcadores/clústeres al cambiar datos o zoom
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Si el contenedor no está visible (display: none en móvil), evitar cálculos de tamaño y límites
    const container = map.getContainer();
    if (!container || container.offsetParent === null) return;
    map.invalidateSize();

    // Si NO hay filtros activos, centrar en España por defecto
    if (!isFiltered) {
      if (!hasInitializedBoundsRef.current && !userLocation && !selectedPlaceId) {
        map.setView(SPAIN_CENTER, SPAIN_DEFAULT_ZOOM);
        hasInitializedBoundsRef.current = true;
      }
    } else {
      // Si hay filtros activos (búsqueda, país, ciudad, categorías...), ajustar límites a los resultados
      const bounds: [number, number][] = [];
      if (userLocation) {
        bounds.push([userLocation.latitude, userLocation.longitude]);
      }
      places.forEach((place) => {
        if (place.latitude == null || place.longitude == null) return;
        const lat =
          typeof place.latitude === "number"
            ? place.latitude
            : parseFloat(String(place.latitude));
        const lng =
          typeof place.longitude === "number"
            ? place.longitude
            : parseFloat(String(place.longitude));
        if (!isNaN(lat) && !isNaN(lng)) {
          bounds.push([lat, lng]);
        }
      });

      if (bounds.length > 0 && !selectedPlaceId) {
        if (bounds.length === 1) {
          map.setView(bounds[0], 15);
        } else {
          map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 16 });
        }
      }
    }

    renderMarkersAndClusters();

    map.on("zoomend", renderMarkersAndClusters);
    return () => {
      map.off("zoomend", renderMarkersAndClusters);
    };
  }, [places, selectedPlaceId, userLocation, isFiltered, renderMarkersAndClusters]);

  // 4. Centrar cuando cambia la selección externa
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!selectedPlaceId) {
      lastCenteredIdRef.current = null;
      return;
    }

    // Evitar volver a volar/centrar el mismo ID ya centrado (previene errores en cascada al cambiar favorito o estado)
    if (lastCenteredIdRef.current === selectedPlaceId) return;

    const place = places.find((p) => p.id === selectedPlaceId);
    if (!place || place.latitude == null || place.longitude == null) return;

    const lat =
      typeof place.latitude === "number"
        ? place.latitude
        : parseFloat(String(place.latitude));
    const lng =
      typeof place.longitude === "number"
        ? place.longitude
        : parseFloat(String(place.longitude));
    if (isNaN(lat) || isNaN(lng)) return;

    // Verificar que el contenedor esté en pantalla y tenga dimensiones mayores a 0 antes de flyTo
    const container = map.getContainer();
    if (!container || container.offsetParent === null) return;

    map.invalidateSize();
    const size = map.getSize();
    if (!size || size.x === 0 || size.y === 0) return;

    lastCenteredIdRef.current = selectedPlaceId;
    map.flyTo([lat, lng], 16, { animate: true, duration: 0.6 });

    const openSelectedPopup = () => {
      const marker = markersRef.current.get(selectedPlaceId);
      marker?.openPopup();
    };

    map.once("moveend", openSelectedPopup);
    const timer = setTimeout(openSelectedPopup, 680);

    return () => {
      map.off("moveend", openSelectedPopup);
      clearTimeout(timer);
    };
  }, [selectedPlaceId, places]);

  const [mapUnlocked, setMapUnlocked] = useState(true);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      {/* Insignia flotante desktop estilo Stitch */}
      <div className="hidden lg:flex items-center gap-1.5 absolute top-3 right-3 z-30 px-3 py-1 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-md border border-slate-200/80 dark:border-slate-800/80 text-xs font-bold text-slate-800 dark:text-slate-200 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Granada Centro: {places.length} locales</span>
      </div>
      {/* Botón flotante móvil para alternar entre interactuar con el mapa o hacer scroll vertical */}
      <div className="absolute top-3 right-3 z-30 lg:hidden">
        <button
          type="button"
          onClick={() => {
            if (!mapInstanceRef.current) return;
            const next = !mapUnlocked;
            setMapUnlocked(next);
            if (next) {
              mapInstanceRef.current.dragging.enable();
              mapInstanceRef.current.touchZoom.enable();
            } else {
              mapInstanceRef.current.dragging.disable();
              mapInstanceRef.current.touchZoom.disable();
            }
          }}
          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold shadow-lg backdrop-blur-md border transition cursor-pointer flex items-center gap-1.5 ${
            mapUnlocked
              ? "bg-slate-900/90 text-white border-slate-700/80"
              : "bg-amber-500 text-slate-950 border-amber-400"
          }`}
        >
          <span>{mapUnlocked ? "🖐️ Mover mapa" : "📜 Deslizar lista"}</span>
        </button>
      </div>
    </div>
  );
}
