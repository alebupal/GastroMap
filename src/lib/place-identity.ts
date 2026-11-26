import { extractFirstUrl } from "./maps";

/**
 * Normaliza una URL de Google Maps para usarla como clave de deduplicación
 * (elimina parámetros de seguimiento, ?entry=, etc., y unifica a minúsculas).
 */
export function normalizeMapsUrlKey(rawUrl?: string | null): string | null {
  const clean = (rawUrl || "").trim();
  if (!clean) return null;
  const extracted = extractFirstUrl(clean);
  try {
    const parsed = new URL(extracted);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "");

    // Conservar solo parámetros relevantes de identificación si existen (cid, q, query, ftid)
    const keepParams = new URLSearchParams();
    for (const key of ["cid", "ftid", "q", "query"]) {
      const val = parsed.searchParams.get(key);
      if (val) keepParams.set(key, val.trim());
    }
    const qs = keepParams.toString();
    const key = `${host}${path}${qs ? `?${qs}` : ""}`.toLowerCase();
    return key.slice(0, 255) || null;
  } catch {
    return null;
  }
}

/**
 * Normaliza el nombre de un establecimiento para comparar duplicados
 * (sin tildes, sin signos de puntuación, sin artículos/prefijos comunes).
 */
export function normalizePlaceName(name?: string | null): string {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(el|la|los|las|bar|restaurante|taberna|mes[oó]n|caf[eé]|cafeteria|pizzeria|bodega|casa)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calcula la distancia en metros entre dos coordenadas (fórmula Haversine).
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface PlaceIdentityCandidate {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  mapsUrlKey?: string | null;
  googleMapsUrl?: string | null;
  googlePlaceId?: string | null;
}

export type DuplicateMatchReason = "google_place_id" | "maps_url" | "name_and_distance";

export function matchPlaceIdentity(
  source: {
    name: string;
    latitude: number | null;
    longitude: number | null;
    mapsUrlKey?: string | null;
    googleMapsUrl?: string | null;
    googlePlaceId?: string | null;
  },
  candidate: PlaceIdentityCandidate
): DuplicateMatchReason | null {
  if (
    source.googlePlaceId &&
    candidate.googlePlaceId &&
    source.googlePlaceId === candidate.googlePlaceId
  ) {
    return "google_place_id";
  }

  const srcUrlKey = source.mapsUrlKey ?? normalizeMapsUrlKey(source.googleMapsUrl);
  const candUrlKey = candidate.mapsUrlKey ?? normalizeMapsUrlKey(candidate.googleMapsUrl);
  if (srcUrlKey && candUrlKey && srcUrlKey === candUrlKey) {
    return "maps_url";
  }

  const srcName = normalizePlaceName(source.name);
  const candName = normalizePlaceName(candidate.name);
  if (
    srcName &&
    candName &&
    (srcName === candName ||
      (srcName.length >= 5 && candName.length >= 5 && (srcName.includes(candName) || candName.includes(srcName)))) &&
    source.latitude != null &&
    source.longitude != null &&
    candidate.latitude != null &&
    candidate.longitude != null
  ) {
    const dist = haversineMeters(
      source.latitude,
      source.longitude,
      candidate.latitude,
      candidate.longitude
    );
    if (dist <= 75) {
      return "name_and_distance";
    }
  }

  return null;
}

/**
 * Genera el nombre con sufijo «(copia)», «(copia 2)», etc. evitando colisiones en destino.
 */
export function buildCopyName(baseName: string, existingNames: Set<string>): string {
  const cleanBase = baseName.replace(/\s*\(copia(?:\s+\d+)?\)\s*$/i, "").trim() || baseName;
  const lowerExisting = new Set(Array.from(existingNames, (n) => n.toLowerCase().trim()));
  const first = `${cleanBase} (copia)`;
  if (!lowerExisting.has(first.toLowerCase())) return first;
  let i = 2;
  while (lowerExisting.has(`${cleanBase} (copia ${i})`.toLowerCase())) {
    i++;
  }
  return `${cleanBase} (copia ${i})`;
}
