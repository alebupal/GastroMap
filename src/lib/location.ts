import { WORLD_COUNTRIES, findCountry, type Country } from "@/data/worldCountries";

export { WORLD_COUNTRIES, findCountry, type Country };

export interface ParsedLocation {
  city: string;
  country: string;
}

/**
 * Parsea una cadena de texto de ciudad/país (ej. "Granada, España", "Nueva York, Estados Unidos", "Madrid")
 * en un objeto estructurado { city, country }.
 */
export function parseCityCountry(rawCity?: string | null): ParsedLocation {
  if (!rawCity || !rawCity.trim()) {
    return { city: "", country: "España" };
  }

  const parts = rawCity.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const matched = findCountry(lastPart);
    if (matched) {
      const city = parts.slice(0, parts.length - 1).join(", ");
      return { city, country: matched.name };
    }
    // Si la última parte no se reconoce como país exacto, se usa tal cual
    const country = lastPart;
    const city = parts.slice(0, parts.length - 1).join(", ");
    return { city, country };
  }

  const single = parts[0];
  // Si coincide con un país conocido, asumimos que es el país
  const matchedSingle = findCountry(single);
  if (matchedSingle && matchedSingle.name.toLowerCase() === single.toLowerCase()) {
    return { city: "", country: matchedSingle.name };
  }

  // Si no, por defecto asumimos España como país
  return { city: single, country: "España" };
}

/**
 * Formatea ciudad y país de forma limpia y consistente (ej. "Granada, España").
 */
export function formatCityCountry(city: string, country?: string): string {
  const c = (city || "").trim();
  const co = (country || "").trim();

  if (!c && !co) return "";
  if (!co) return c;
  if (!c) return co;

  // Evitar duplicar el país si la ciudad ya lo incluye al final
  if (c.toLowerCase().endsWith(co.toLowerCase())) {
    return c;
  }

  return `${c}, ${co}`;
}
