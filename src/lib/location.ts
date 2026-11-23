import { WORLD_COUNTRIES, findCountry, type Country } from "@/data/worldCountries";

export { WORLD_COUNTRIES, findCountry, type Country };

export interface ParsedLocation {
  city: string;
  country: string;
}

function normalizeLocationText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const COUNTRY_ALIASES: Record<string, string> = {
  chequia: "República Checa",
  czechia: "República Checa",
  "czech republic": "República Checa",
  usa: "Estados Unidos",
  "u.s.a.": "Estados Unidos",
  "ee. uu.": "Estados Unidos",
  eeuu: "Estados Unidos",
  "united states of america": "Estados Unidos",
  uk: "Reino Unido",
  "u.k.": "Reino Unido",
  inglaterra: "Reino Unido",
  england: "Reino Unido",
  escocia: "Reino Unido",
  scotland: "Reino Unido",
  holanda: "Países Bajos",
  holland: "Países Bajos",
  "the netherlands": "Países Bajos",
  mexico: "México",
  japon: "Japón",
  japan: "Japón",
  tailandia: "Tailandia",
  thailand: "Tailandia",
  turquia: "Turquía",
  turkiye: "Turquía",
  "south korea": "Corea del Sur",
  "corea del sur": "Corea del Sur",
};

const KNOWN_FOREIGN_CITIES: Record<string, string> = {
  praga: "República Checa",
  prague: "República Checa",
  "nueva york": "Estados Unidos",
  "new york": "Estados Unidos",
  miami: "Estados Unidos",
  "los angeles": "Estados Unidos",
  "san francisco": "Estados Unidos",
  chicago: "Estados Unidos",
  "ciudad de mexico": "México",
  cdmx: "México",
  tokio: "Japón",
  tokyo: "Japón",
  kyoto: "Japón",
  kioto: "Japón",
  osaka: "Japón",
  fukuoka: "Japón",
  bangkok: "Tailandia",
  "chiang mai": "Tailandia",
  paris: "Francia",
  lyon: "Francia",
  marsella: "Francia",
  londres: "Reino Unido",
  london: "Reino Unido",
  edimburgo: "Reino Unido",
  manchester: "Reino Unido",
  roma: "Italia",
  rome: "Italia",
  milan: "Italia",
  milano: "Italia",
  florencia: "Italia",
  venecia: "Italia",
  napoles: "Italia",
  lisboa: "Portugal",
  lisbon: "Portugal",
  oporto: "Portugal",
  porto: "Portugal",
  amsterdam: "Países Bajos",
  berlin: "Alemania",
  munich: "Alemania",
  viena: "Austria",
  budapest: "Hungría",
  atenas: "Grecia",
  estambul: "Turquía",
  bruselas: "Bélgica",
  dublin: "Irlanda",
  zurich: "Suiza",
  ginebra: "Suiza",
  seul: "Corea del Sur",
  seoul: "Corea del Sur",
  "buenos aires": "Argentina",
  bogota: "Colombia",
  lima: "Perú",
};

function matchExactCountry(segment: string): string | null {
  const norm = normalizeLocationText(segment);
  if (!norm || norm.length < 2) return null;

  if (COUNTRY_ALIASES[norm]) {
    return COUNTRY_ALIASES[norm];
  }

  const exact = WORLD_COUNTRIES.find(
    (c) =>
      normalizeLocationText(c.name) === norm ||
      normalizeLocationText(c.nameEn) === norm
  );
  return exact ? exact.name : null;
}

function inferCountryFromAddress(rawAddress?: string | null): string | null {
  if (!rawAddress || !rawAddress.trim()) return null;
  const segments = rawAddress
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  // Priorizar último segmento (formato occidental) y primero (formato japonés/asiático)
  const ordered = [
    segments[segments.length - 1],
    segments[0],
    ...segments.slice(1, -1),
  ];

  for (const seg of ordered) {
    const matched = matchExactCountry(seg);
    if (matched) return matched;
  }
  return null;
}

/**
 * Parsea una cadena de texto de ciudad/país (ej. "Granada, España", "Nueva York, Estados Unidos", "Praga")
 * usando opcionalmente la dirección completa para inferir el país real.
 */
export function parseCityCountry(
  rawCity?: string | null,
  rawAddress?: string | null
): ParsedLocation {
  if (!rawCity || !rawCity.trim()) {
    const fromAddr = inferCountryFromAddress(rawAddress);
    return { city: "", country: fromAddr || "España" };
  }

  const parts = rawCity.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const matched = matchExactCountry(lastPart) || findCountry(lastPart)?.name;
    if (matched) {
      const city = parts.slice(0, parts.length - 1).join(", ");
      return { city, country: matched };
    }
    const country = lastPart;
    const city = parts.slice(0, parts.length - 1).join(", ");
    return { city, country };
  }

  const single = parts[0];
  // Si coincide exactamente con un país conocido, asumimos que es el país
  const matchedSingle = matchExactCountry(single);
  if (matchedSingle) {
    return { city: "", country: matchedSingle };
  }

  // Intentar inferir el país desde la dirección completa (ej. "Chequia", "Estados Unidos", "Japón", "México", "Tailandia")
  const fromAddress = inferCountryFromAddress(rawAddress);
  if (fromAddress) {
    return { city: single, country: fromAddress };
  }

  // Fallback por ciudad internacional conocida
  const knownCityCountry = KNOWN_FOREIGN_CITIES[normalizeLocationText(single)];
  if (knownCityCountry) {
    return { city: single, country: knownCityCountry };
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
