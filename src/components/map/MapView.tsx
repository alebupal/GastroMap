"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createPlaceMarkerIcon, createUserLocationIcon } from "@/lib/map-icons";
import type { PlaceWithDetails } from "@/lib/actions/places";

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

  return `
    <div style="padding: 12px; min-width: 200px; max-width: 260px; font-family: system-ui, sans-serif;">
      <div style="display: flex; align-items: start; justify-content: space-between; gap: 8px;">
        <strong style="font-size: 14px; color: #0f172a; line-height: 1.2;">${place.name}</strong>
        <span style="font-size: 11px; font-weight: 700; color: #047857; background: #ecfdf5; padding: 1px 6px; border-radius: 4px; white-space: nowrap;">${place.priceRange}</span>
      </div>
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

  // 3. Renderizar y actualizar marcadores de lugares
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Limpiar marcadores viejos que ya no están en places
    const validPlaceIds = new Set(places.map((p) => p.id));
    markersRef.current.forEach((marker, id) => {
      if (!validPlaceIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    const bounds: [number, number][] = [];

    if (userLocation) {
      bounds.push([userLocation.latitude, userLocation.longitude]);
    }

    places.forEach((place) => {
      if (place.latitude == null || place.longitude == null) return;

      const lat = typeof place.latitude === "number" ? place.latitude : parseFloat(String(place.latitude));
      const lng = typeof place.longitude === "number" ? place.longitude : parseFloat(String(place.longitude));
      if (isNaN(lat) || isNaN(lng)) return;

      const latLng: [number, number] = [lat, lng];
      bounds.push(latLng);

      const isSelected = selectedPlaceId === place.id;
      const primaryOccasion = place.occasions[0];
      const occasionInfo = primaryOccasion ? occasionMap[primaryOccasion] : undefined;
      const icon = createPlaceMarkerIcon(primaryOccasion, occasionInfo?.icon, isSelected);

      let marker = markersRef.current.get(place.id);
      const popupHtml = getPlacePopupHtml(place, lat, lng);

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

    // Ajustar encuadre del mapa si hay varios sitios y no hay sitio seleccionado específico
    if (bounds.length > 0 && !selectedPlaceId) {
      if (bounds.length === 1) {
        map.setView(bounds[0], 15);
      } else {
        map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 16 });
      }
    }
  }, [places, selectedPlaceId, occasionMap, onSelectPlace, userLocation]);

  // 4. Centrar cuando cambia la selección externa
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPlaceId) return;

    let marker = markersRef.current.get(selectedPlaceId);
    if (!marker || !map.hasLayer(marker)) {
      // Si el marcador no estaba en el mapa, buscar el lugar y forzar su creación
      const place = places.find((p) => p.id === selectedPlaceId);
      if (place && place.latitude != null && place.longitude != null) {
        const lat = typeof place.latitude === "number" ? place.latitude : parseFloat(String(place.latitude));
        const lng = typeof place.longitude === "number" ? place.longitude : parseFloat(String(place.longitude));
        if (!isNaN(lat) && !isNaN(lng)) {
          const primaryOccasion = place.occasions[0];
          const occasionInfo = primaryOccasion ? occasionMap[primaryOccasion] : undefined;
          const icon = createPlaceMarkerIcon(primaryOccasion, occasionInfo?.icon, true);
          const popupHtml = getPlacePopupHtml(place, lat, lng);
          marker = L.marker([lat, lng], {
            icon,
            zIndexOffset: 500,
          })
            .addTo(map)
            .bindPopup(popupHtml)
            .on("click", () => {
              if (onSelectPlace) onSelectPlace(place.id);
            });
          markersRef.current.set(place.id, marker);
        }
      }
    }

    if (marker) {
      const latLng = marker.getLatLng();
      map.invalidateSize();
      map.flyTo(latLng, 16, { animate: true, duration: 0.6 });

      map.once("moveend", () => {
        marker?.openPopup();
      });

      const timer = setTimeout(() => {
        marker?.openPopup();
      }, 650);

      return () => clearTimeout(timer);
    }
  }, [selectedPlaceId, places, occasionMap]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  );
}
