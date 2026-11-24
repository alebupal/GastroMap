export interface ParsedMapUrl {
  originalUrl: string;
  resolvedUrl?: string;
  name?: string;
  address?: string;
  priceRange?: "€" | "€€" | "€€€" | "€€€€";
  categoryHint?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Extrae la primera URL http(s) aunque el usuario pegue texto compartido desde WhatsApp/Maps
 * (ej. "Mira este restaurante: https://maps.app.goo.gl/xyz").
 */
export function extractFirstUrl(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/https?:\/\/[^\s<>"]+/i);
  return match ? match[0].replace(/[),.;]+$/, "") : trimmed;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function inferPriceRangeFromText(text: string): "€" | "€€" | "€€€" | "€€€€" | undefined {
  // 1. Símbolos explícitos (€€€€, $$$, etc.)
  const symMatch = text.match(/(?:^|[\s·•(])([€$£]{1,4})(?:[\s·•)]|$)/);
  if (symMatch) {
    const len = symMatch[1].length;
    if (len === 1) return "€";
    if (len === 2) return "€€";
    if (len === 3) return "€€€";
    if (len >= 4) return "€€€€";
  }
  // 2. Rangos numéricos típicos de Google Maps (ej. "10–20 €", "€20-30", "30-40 €")
  const rangeMatch = text.match(/(?:€\s*)?(\d{1,3})\s*[-–]\s*(\d{1,3})\s*€?|(\d{1,3})\s*\+\s*€/);
  if (rangeMatch) {
    const maxVal = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : parseInt(rangeMatch[3], 10);
    if (!isNaN(maxVal)) {
      if (maxVal <= 15) return "€";
      if (maxVal <= 30) return "€€";
      if (maxVal <= 50) return "€€€";
      return "€€€€";
    }
  }
  return undefined;
}

export interface ResolvedGoogleMapsResult {
  resolvedUrl: string;
  ogName?: string;
  ogAddress?: string;
  ogPriceRange?: "€" | "€€" | "€€€" | "€€€€";
  ogCategoryHint?: string;
  htmlLat?: number;
  htmlLng?: number;
}

/**
 * Resuelve URLs acortadas de Google Maps (maps.app.goo.gl, goo.gl/maps, share.google)
 * y extrae metadatos Open Graph (nombre, dirección, rango de precio y coordenadas embebidas)
 * del HTML devuelto por Google Maps, todo sin necesidad de API Key de pago.
 */
export async function resolveGoogleMapsDetails(rawInput: string): Promise<ResolvedGoogleMapsResult> {
  const url = extractFirstUrl(rawInput);
  const result: ResolvedGoogleMapsResult = { resolvedUrl: url };

  try {
    const isMapsUrl = /(google\.|goo\.gl|g\.co\/kgs|share\.google|maps\.app)/i.test(url);
    if (!isMapsUrl) {
      return result;
    }

    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(4500),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
    });

    if (response.url && response.url !== url) {
      result.resolvedUrl = response.url;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return result;
    }

    // Leer solo el bloque inicial donde viven las etiquetas <meta> y staticmap
    const html = (await response.text()).slice(0, 65000);

    // 1. og:title suele ser "Nombre del local · Dirección completa" o "Nombre - Google Maps"
    const ogTitleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    if (ogTitleMatch) {
      const cleanTitle = decodeHtmlEntities(ogTitleMatch[1])
        .replace(/\s*[-–—]\s*Google\s*Maps\s*$/i, "")
        .trim();
      if (cleanTitle && !/^google\s*maps$/i.test(cleanTitle)) {
        const parts = cleanTitle.split(/\s*[·•]\s*/);
        if (parts.length >= 2) {
          result.ogName = parts[0].trim();
          result.ogAddress = parts.slice(1).join(", ").trim();
        } else {
          result.ogName = cleanTitle;
        }
      }
    }

    // 2. og:description suele incluir valoración, categoría y rango de precio (ej. "★★★★☆ · Restaurante de tapas · €€")
    const ogDescMatch =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    if (ogDescMatch) {
      const desc = decodeHtmlEntities(ogDescMatch[1]).trim();
      result.ogPriceRange = inferPriceRangeFromText(desc);
      // Extraer categoría legible quitando estrellas y símbolos de precio
      const descParts = desc
        .split(/\s*[·•]\s*/)
        .map((p) => p.trim())
        .filter((p) => p && !/^[★☆\d.,()€$£\s-]+$/.test(p));
      if (descParts.length > 0) {
        result.ogCategoryHint = descParts[0];
      }
    }

    // 3. Coordenadas embebidas en og:image (maps.google.com/maps/api/staticmap?center=37.177%2C-3.598...)
    const ogImageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogImageMatch) {
      const imgUrl = decodeHtmlEntities(ogImageMatch[1]);
      const centerMatch = imgUrl.match(/center=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/i);
      if (centerMatch) {
        result.htmlLat = parseFloat(centerMatch[1]);
        result.htmlLng = parseFloat(centerMatch[2]);
      }
    }

    return result;
  } catch {
    return result;
  }
}

/**
 * Compatibilidad: resuelve la URL final acortada de Google Maps.
 */
export async function resolveGoogleMapsUrl(url: string): Promise<string> {
  const details = await resolveGoogleMapsDetails(url);
  return details.resolvedUrl;
}

/**
 * Parsea una URL de Google Maps para extraer nombre y coordenadas (lat, lng).
 */
export function parseGoogleMapsUrl(rawUrl: string): ParsedMapUrl {
  const cleanUrl = extractFirstUrl(rawUrl);
  const result: ParsedMapUrl = { originalUrl: cleanUrl };

  try {
    // 1. Extraer coordenadas exactas del pin en datos internos de Google Maps (!3d... !4d...)
    const pinCoordsMatch = cleanUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (pinCoordsMatch) {
      result.latitude = parseFloat(pinCoordsMatch[1]);
      result.longitude = parseFloat(pinCoordsMatch[2]);
    }

    // 2. Extraer coordenadas en query (?q=37.389,-5.984 o query=37.389,-5.984 o ll=...)
    if (!result.latitude) {
      const qCoordsMatch = cleanUrl.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qCoordsMatch) {
        result.latitude = parseFloat(qCoordsMatch[1]);
        result.longitude = parseFloat(qCoordsMatch[2]);
      }
    }

    // 3. Como último recurso, extraer centro de la cámara del mapa (@37.389,-5.984)
    if (!result.latitude) {
      const atCoordsMatch = cleanUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atCoordsMatch) {
        result.latitude = parseFloat(atCoordsMatch[1]);
        result.longitude = parseFloat(atCoordsMatch[2]);
      }
    }

    // 4. Nombre desde ?q=Texto (si no son coordenadas)
    const qNameMatch = cleanUrl.match(/[?&]q=([^&]+)/);
    if (qNameMatch && !/^-?\d+\.\d+,/.test(decodeURIComponent(qNameMatch[1]))) {
      result.name = decodeURIComponent(qNameMatch[1].replace(/\+/g, " "));
    }

    // 5. Extraer nombre desde /place/Nombre+Del+Sitio/
    const placeMatch = cleanUrl.match(/\/place\/([^/@?]+)/);
    if (placeMatch) {
      const cleanName = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
      result.name = cleanName;
    }
  } catch {
    // Fallback silencioso
  }

  return result;
}
