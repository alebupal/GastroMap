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
}

const PRICE_RANGE_LABELS: Record<string, string> = {
  "€": "< 15 €",
  "€€": "15 - 30 €",
  "€€€": "30 - 50 €",
  "€€€€": "> 50 €",
  "???": "???",
};

// Función auxiliar para construir el contenido HTML enriquecido del popup
function getPlacePopupHtml(place: PlaceWithDetails, lat: number, lng: number) {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const distanceLabel =
    typeof place.distanceMeters === "number"
      ? `<span style="font-size: 11px; font-weight: 600; color: #2563eb; background: #eff6ff; padding: 2px 6px; border-radius: 9999px;">📍 ${
          place.distanceMeters < 1000
            ? `${place.distanceMeters} m`
            : `${(place.distanceMeters / 1000).toFixed(1)} km`
        }</span>`
      : "";

  const statusBanner =
    place.status === "permanently_closed"
      ? `<div style="margin-top: 6px;"><span style="font-size: 10px; font-weight: 700; color: #b91c1c; background: #fef2f2; padding: 2px 6px; border-radius: 9999px;">🚫 Cerrado permanentemente</span></div>`
      : place.status === "temporarily_closed"
      ? `<div style="margin-top: 6px;"><span style="font-size: 10px; font-weight: 700; color: #b45309; background: #fffbeb; padding: 2px 6px; border-radius: 9999px;">⏸️ Cerrado temporalmente</span></div>`
      : "";

  return `
    <div style="padding: 12px; min-width: 200px; max-width: 260px; font-family: system-ui, sans-serif;">
      <div style="display: flex; align-items: start; justify-content: space-between; gap: 8px;">
        <strong style="font-size: 14px; color: #0f172a; line-height: 1.2;">${place.name}</strong>
        <span style="font-size: 11px; font-weight: 700; color: #047857; background: #ecfdf5; padding: 1px 6px; border-radius: 4px; white-space: nowrap;">${PRICE_RANGE_LABELS[place.priceRange] || place.priceRange}</span>
      </div>
      ${statusBanner}
      ${
        place.city || place.address
          ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">${place.city ? place.city : ""}${
              place.city && place.address ? " • " : ""
            }${place.address || ""}</p>`
          : ""
      }
      ${distanceLabel ? `<div style="margin-top: 6px;">${distanceLabel}</div>` : ""}
      ${
        place.notes
          ? `<p style="margin: 8px 0 0 0; font-size: 11px; color: #475569; font-style: italic; background: #f8fafc; padding: 6px; border-radius: 6px;">«${place.notes}»</p>`
          : ""
      }
      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 10px; color: #94a3b8;">Por @${place.createdByUsername || place.createdByName.toLowerCase().replace(/\s+/g, "")}</span>
        <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; font-weight: 600; color: #2563eb; text-decoration: none;">
          Cómo llegar ↗
        </a>
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
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const clusterMarkersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);

  // 1. Inicialización única del mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Centro inicial: Madrid por defecto o coordenadas del usuario si existen
    const initialCenter: [number, number] = userLocation
      ? [userLocation.latitude, userLocation.longitude]
      : [40.4168, -3.7038];
    const initialZoom = userLocation ? 14 : 6;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
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

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
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

    renderMarkersAndClusters();

    map.on("zoomend", renderMarkersAndClusters);
    return () => {
      map.off("zoomend", renderMarkersAndClusters);
    };
  }, [places, selectedPlaceId, userLocation, renderMarkersAndClusters]);

  // 4. Centrar cuando cambia la selección externa
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPlaceId) return;

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

    map.invalidateSize();
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
      {/* Botón flotante móvil para alternar entre interactuar con el mapa o hacer scroll vertical */}
      <div className="absolute top-3 right-3 z-[1000] lg:hidden">
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
