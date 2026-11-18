export interface GeocodingResult {
  displayName: string;
  road?: string;
  houseNumber?: string;
  city?: string;
  province?: string;
  name?: string;
  latitude: number;
  longitude: number;
}

/**
 * Busca direcciones y establecimientos en España usando la API abierta de Nominatim (OpenStreetMap)
 */
export async function searchAddressNominatim(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=es&q=${encodeURIComponent(
    trimmed
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "GastroMap/0.1.0 (self-hosted gastronomic tracker)",
        "Accept-Language": "es-ES,es;q=0.9",
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
        city,
        province,
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
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "GastroMap/0.1.0 (self-hosted gastronomic tracker)",
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
      city,
      province,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    };
  } catch (error) {
    console.error("[Geocoding] Error en geocodificación inversa OSM:", error);
    return null;
  }
}
