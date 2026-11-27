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
 * Comprueba si una URL pertenece a un dominio/ruta oficial de Google Maps.
 * Una cadena vacía se considera válida (el sitio puede usar solo coordenadas).
 */
export function isValidGoogleMapsUrl(rawUrl?: string | null): boolean {
  const clean = (rawUrl || "").trim();
  if (!clean) return true;
  const extracted = extractFirstUrl(clean);
  try {
    const parsed = new URL(extracted);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host === "maps.app.goo.gl") return true;
    if (host === "share.google") return true;
    if (host === "goo.gl" && path.startsWith("/maps")) return true;
    if (host === "g.co" && (path.startsWith("/kgs") || path.startsWith("/maps"))) return true;
    if (host.startsWith("maps.google.")) return true;
    if (/^(www\.)?google\.[a-z.]+$/.test(host) && path.startsWith("/maps")) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Devuelve el enlace efectivo para abrir el local en Google Maps:
 * prioriza la URL de Maps si es válida y, si no, genera un enlace directo por coordenadas.
 */
export function getMapsHref(place: {
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): string | null {
  const cleanUrl = (place.googleMapsUrl || "").trim();
  if (cleanUrl && isValidGoogleMapsUrl(cleanUrl)) {
    return cleanUrl;
  }
  if (place.latitude != null && place.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  }
  return null;
}

/**
 * Genera una URL de búsqueda en Google para el establecimiento.
 */
export function getGoogleSearchHref(name: string, city?: string | null): string {
  const query = [name, city].filter(Boolean).join(" ").trim();
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
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

const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

function decodeHtmlEntities(str: string): string {
  return str.replace(
    /&(amp|quot|#39|apos|lt|gt|#x[0-9a-f]+|#\d+);/gi,
    (match) => {
      const lower = match.toLowerCase();
      if (HTML_ENTITY_MAP[lower]) return HTML_ENTITY_MAP[lower];
      if (lower.startsWith("&#x")) {
        const code = parseInt(lower.slice(3, -1), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (lower.startsWith("&#")) {
        const code = parseInt(lower.slice(2, -1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return match;
    }
  );
}

function isGenericGoogleMapsDescription(text: string): boolean {
  return /(find local businesses|view maps|driving directions|google maps|busca negocios locales|consulta mapas|informaci[oó]n sobre rutas|before you continue|antes de ir a google)/i.test(
    text
  );
}

/**
 * Detecta si un texto parece una dirección o nombre de calle en lugar del nombre de un establecimiento
 * (ej. "C. de Alcalá, 45", "Calle Reyes Católicos", "Av. de la Constitución, 12", "Camino el Bollullo").
 */
export function looksLikeStreetAddress(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /^(c\/|c\.|cl\.|calle|av\.|avda\.?|avenida|pl\.|plz\.?|plaza|pza\.?|p\.º|pº|paseo|camino|cno\.?|ctra\.?|carretera|ronda|traves[ií]a|glorieta|rambla|carrer|rua|rue|via|viale|corso|strada|boulevard|blvd\.?)\s+/i.test(
      t
    )
  ) {
    return true;
  }
  if (/^\d{1,5}\s+[a-záéíóúñ\s]+\b(st|street|ave|avenue|rd|road|blvd|ln|lane|dr|drive)\b/i.test(t)) {
    return true;
  }
  if (/,\s*\d{5}\b/.test(t)) {
    return true;
  }
  return false;
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
      if (maxVal <= 20) return "€";
      if (maxVal <= 30) return "€€";
      if (maxVal <= 40) return "€€€";
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

function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.startsWith("fe80:") ||
    h.startsWith("fc") ||
    h.startsWith("fd")
  ) {
    return true;
  }
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [, a, b] = ipv4.map(Number);
  return (
    a === 127 ||
    a === 10 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function getSafeGoogleMapsFetchUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const host = parsed.hostname.toLowerCase();
    if (isPrivateOrLocalHostname(host)) return null;

    const isAllowedHost =
      host === "maps.app.goo.gl" ||
      host === "share.google" ||
      host === "goo.gl" ||
      host === "g.co" ||
      /^(maps|consent)\.google\.[a-z.]+$/.test(host) ||
      /^(www\.)?google\.[a-z.]+$/.test(host);

    if (!isAllowedHost) return null;

    const portSuffix = parsed.port ? `:${parsed.port}` : "";
    const rebuilt = new URL(
      `${parsed.pathname}${parsed.search}${parsed.hash}`,
      `${parsed.protocol}//${host}${portSuffix}`
    );
    return rebuilt.toString();
  } catch {
    return null;
  }
}

async function fetchGoogleMapsWithSafeRedirects(initialUrl: string): Promise<Response | null> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop < 4; hop++) {
    const safeUrl = getSafeGoogleMapsFetchUrl(currentUrl);
    if (!safeUrl) return null;
    const response = await fetch(safeUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(4500),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return response;
      const nextUrl = new URL(location, safeUrl).toString();
      currentUrl = nextUrl;
      continue;
    }

    return response;
  }
  return null;
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
    if (!isValidGoogleMapsUrl(url) || !getSafeGoogleMapsFetchUrl(url)) {
      return result;
    }

    const response = await fetchGoogleMapsWithSafeRedirects(url);
    if (!response) {
      return result;
    }

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
      if (!isGenericGoogleMapsDescription(desc)) {
        result.ogPriceRange = inferPriceRangeFromText(desc);
        // Extraer categoría legible quitando estrellas y símbolos de precio
        const descParts = desc
          .split(/\s*[·•]\s*/)
          .map((p) => p.trim())
          .filter(
            (p) =>
              p &&
              !/^[★☆\d.,()€$£\s-]+$/.test(p) &&
              !isGenericGoogleMapsDescription(p)
          );
        if (descParts.length > 0) {
          result.ogCategoryHint = descParts[0];
        }
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

export interface GooglePlacesEnrichment {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  priceRange?: "€" | "€€" | "€€€" | "€€€€";
  description?: string;
  primaryType?: string;
  types?: string[];
  website?: string;
  phone?: string;
}

function mapGooglePriceLevel(
  level?: string
): "€" | "€€" | "€€€" | "€€€€" | undefined {
  switch (level) {
    case "PRICE_LEVEL_FREE":
    case "PRICE_LEVEL_INEXPENSIVE":
      return "€";
    case "PRICE_LEVEL_MODERATE":
      return "€€";
    case "PRICE_LEVEL_EXPENSIVE":
      return "€€€";
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return "€€€€";
    default:
      return undefined;
  }
}

function mapGooglePriceRange(
  priceRange?: { startPrice?: { units?: string }; endPrice?: { units?: string } }
): "€" | "€€" | "€€€" | "€€€€" | undefined {
  if (!priceRange) return undefined;
  const endUnits = priceRange.endPrice?.units ? parseInt(priceRange.endPrice.units, 10) : NaN;
  const startUnits = priceRange.startPrice?.units ? parseInt(priceRange.startPrice.units, 10) : NaN;
  const ref = !isNaN(endUnits) ? endUnits : !isNaN(startUnits) ? startUnits : NaN;
  if (isNaN(ref)) return undefined;
  if (ref <= 20) return "€";
  if (ref <= 30) return "€€";
  if (ref <= 40) return "€€€";
  return "€€€€";
}

/**
 * Opción A: Consulta oficial a Google Places API (New) usando la clave opcional configurada en /admin.
 * Devuelve nombre oficial, dirección, coordenadas, rango de precio, descripción editorial y tipos.
 */
export async function fetchGooglePlacesDetails(params: {
  apiKey: string;
  query: string;
  latitude?: number;
  longitude?: number;
}): Promise<GooglePlacesEnrichment | null> {
  const apiKey = params.apiKey.trim();
  const textQuery = params.query.trim();
  if (!apiKey || !textQuery) return null;

  try {
    const body: Record<string, unknown> = {
      textQuery,
      languageCode: "es",
      maxResultCount: 1,
    };
    if (
      typeof params.latitude === "number" &&
      typeof params.longitude === "number" &&
      !isNaN(params.latitude) &&
      !isNaN(params.longitude)
    ) {
      body.locationBias = {
        circle: {
          center: {
            latitude: params.latitude,
            longitude: params.longitude,
          },
          radius: 500.0,
        },
      };
    }

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.priceLevel,places.priceRange,places.editorialSummary,places.primaryType,places.primaryTypeDisplayName,places.types",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const place = Array.isArray(data?.places) ? data.places[0] : null;
    if (!place) return null;

    return {
      name: place.displayName?.text || undefined,
      address: place.formattedAddress || undefined,
      latitude: typeof place.location?.latitude === "number" ? place.location.latitude : undefined,
      longitude: typeof place.location?.longitude === "number" ? place.location.longitude : undefined,
      priceRange: mapGooglePriceLevel(place.priceLevel) || mapGooglePriceRange(place.priceRange),
      description: place.editorialSummary?.text || undefined,
      primaryType: place.primaryType || undefined,
      types: Array.isArray(place.types) ? place.types : undefined,
      website: place.websiteUri || undefined,
      phone: place.nationalPhoneNumber || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Sugiere planes/ocasiones de GastroMap a partir de tipos de Google Places,
 * categoría Open Graph o extratags de OpenStreetMap (cuisine / amenity).
 */
export function suggestOccasionsFromMetadata(input: {
  types?: string[];
  categoryHint?: string;
  cuisine?: string;
  amenity?: string;
}): string[] {
  const haystack = [
    ...(input.types || []),
    input.categoryHint || "",
    input.cuisine || "",
    input.amenity || "",
  ]
    .join(" ")
    .toLowerCase();

  const suggestions = new Set<string>();
  if (/(breakfast|brunch|bakery|panader|desayun|churrer)/.test(haystack)) {
    suggestions.add("desayuno");
  }
  if (/(cafe|coffee|cafeter|tea_house|pastel|ice_cream|helad|meriend|sweet|dessert)/.test(haystack)) {
    suggestions.add("cafe");
  }
  if (/(tapas|taberna|mes[oó]n|bar|pub|cervecer|vinoteca|wine_bar)/.test(haystack)) {
    suggestions.add("tapear");
  }
  if (/(cocktail|coctel|night_club|lounge|copas|pub)/.test(haystack)) {
    suggestions.add("copas");
  }
  if (/(fast_food|burger|hamburgues|pizza|kebab|taco|ramen|street_food|sandwich|bocad)/.test(haystack)) {
    suggestions.add("informal");
  }
  if (/(restaurant|restaurante|steak|seafood|marisquer|mediterranean|spanish|italian|japanese|mexican|bistro)/.test(haystack)) {
    suggestions.add("comer");
  }

  return Array.from(suggestions);
}
