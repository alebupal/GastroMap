export interface ParsedMapUrl {
  originalUrl: string;
  resolvedUrl?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Intenta resolver URLs acortadas de Google Maps (maps.app.goo.gl)
 * con un timeout estricto de 2.5s para no retrasar la experiencia móvil.
 */
export async function resolveGoogleMapsUrl(url: string): Promise<string> {
  try {
    if (!url.includes("goo.gl") && !url.includes("maps.app.goo.gl")) {
      return url;
    }

    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(2500),
    });

    return response.url || url;
  } catch {
    return url;
  }
}

/**
 * Parsea una URL de Google Maps para extraer nombre y coordenadas (lat, lng).
 */
export function parseGoogleMapsUrl(rawUrl: string): ParsedMapUrl {
  const result: ParsedMapUrl = { originalUrl: rawUrl };

  try {
    // 1. Extraer coordenadas exactas del pin en datos internos de Google Maps (!3d... !4d...)
    const pinCoordsMatch = rawUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (pinCoordsMatch) {
      result.latitude = parseFloat(pinCoordsMatch[1]);
      result.longitude = parseFloat(pinCoordsMatch[2]);
    }

    // 2. Extraer coordenadas en query (?q=37.389,-5.984 o query=37.389,-5.984 o ll=...)
    if (!result.latitude) {
      const qCoordsMatch = rawUrl.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qCoordsMatch) {
        result.latitude = parseFloat(qCoordsMatch[1]);
        result.longitude = parseFloat(qCoordsMatch[2]);
      }
    }

    // 3. Como último recurso, extraer centro de la cámara del mapa (@37.389,-5.984)
    if (!result.latitude) {
      const atCoordsMatch = rawUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atCoordsMatch) {
        result.latitude = parseFloat(atCoordsMatch[1]);
        result.longitude = parseFloat(atCoordsMatch[2]);
      }
    }

    // 3. Extraer nombre desde /place/Nombre+Del+Sitio/
    const placeMatch = rawUrl.match(/\/place\/([^/@?]+)/);
    if (placeMatch) {
      const cleanName = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      result.name = cleanName;
    }
  } catch {
    // Fallback silencioso
  }

  return result;
}
