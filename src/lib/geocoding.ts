import { APP_VERSION } from "./version";

export interface GeocodingExtraTags {
  cuisine?: string;
  amenity?: string;
  website?: string;
  phone?: string;
  description?: string;
  openingHours?: string;
}

export interface GeocodingResult {
  displayName: string;
  road?: string;
  houseNumber?: string;
  postcode?: string;
  city?: string;
  province?: string;
  country?: string;
  name?: string;
  extratags?: GeocodingExtraTags;
  latitude: number;
  longitude: number;
}

function parseExtraTags(raw: any): GeocodingExtraTags | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const parsed: GeocodingExtraTags = {
    cuisine: typeof raw.cuisine === "string" ? raw.cuisine : undefined,
    amenity: typeof raw.amenity === "string" ? raw.amenity : undefined,
    website:
      typeof raw.website === "string"
        ? raw.website
        : typeof raw["contact:website"] === "string"
        ? raw["contact:website"]
        : undefined,
    phone:
      typeof raw.phone === "string"
        ? raw.phone
        : typeof raw["contact:phone"] === "string"
        ? raw["contact:phone"]
        : undefined,
    description:
      typeof raw["description:es"] === "string"
        ? raw["description:es"]
        : typeof raw.description === "string"
        ? raw.description
        : undefined,
    openingHours: typeof raw.opening_hours === "string" ? raw.opening_hours : undefined,
  };
  return Object.values(parsed).some(Boolean) ? parsed : undefined;
}

/**
 * Busca direcciones y establecimientos a nivel mundial usando la API abierta de Nominatim (OpenStreetMap)
 */
export async function searchAddressNominatim(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  // Búsqueda mundial sin restricción de país con extratags de OpenStreetMap (cocina, web, tipo)
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&extratags=1&limit=6&q=${encodeURIComponent(
    trimmed
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": `GastroMap/${APP_VERSION} (self-hosted gastronomic tracker)`,
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(4500),
      next: { revalidate: 3600 }, // Cachear búsquedas idénticas 1 hora
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => {
      const addr = item.address || {};
      const road = addr.road || addr.pedestrian || addr.footway || addr.street;
      const houseNumber = addr.house_number;
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.hamlet ||
        addr.suburb;
      const province = addr.province || addr.state;

      return {
        displayName: item.display_name,
        name: item.name || undefined,
        road: road ? `${road}${houseNumber ? ` ${houseNumber}` : ""}` : undefined,
        houseNumber,
        postcode: addr.postcode,
        city,
        province,
        country: addr.country,
        extratags: parseExtraTags(item.extratags),
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      };
    });
  } catch (error) {
    console.error("[Geocoding] Error consultando Nominatim OSM:", error);
    return [];
  }
}

/**
 * Geocodificación Inversa: a partir de coordenadas (lat, lng), obtiene
 * la calle, número, municipio/población y provincia reales.
 */
export async function reverseGeocodeNominatim(
  lat: number,
  lng: number
): Promise<GeocodingResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&extratags=1&lat=${lat}&lon=${lng}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": `GastroMap/${APP_VERSION} (self-hosted gastronomic tracker)`,
        "Accept-Language": "es-ES,es;q=0.9",
      },
      signal: AbortSignal.timeout(4500),
      next: { revalidate: 86400 }, // Las coordenadas no cambian de pueblo: cachear 24h
    });

    if (!res.ok) return null;

    const item = await res.json();
    if (!item || !item.address) return null;

    const addr = item.address;
    const road = addr.road || addr.pedestrian || addr.footway || addr.street;
    const houseNumber = addr.house_number;
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.hamlet ||
      addr.suburb;
    const province = addr.province || addr.state;

    return {
      displayName: item.display_name,
      name: item.name || addr.amenity || addr.restaurant || addr.bar || undefined,
      road: road ? `${road}${houseNumber ? ` ${houseNumber}` : ""}` : undefined,
      houseNumber,
      postcode: addr.postcode,
      city,
      province,
      country: addr.country,
      extratags: parseExtraTags(item.extratags),
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    };
  } catch (error) {
    console.error("[Geocoding] Error en geocodificación inversa OSM:", error);
    return null;
  }
}
