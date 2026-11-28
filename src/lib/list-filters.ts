import { normalizeSearchText } from "@/lib/search";
import { parseCityCountry, resolveFilterCity } from "@/lib/location";

export interface ListFilterCriteria {
  textSearch?: string;
  selectedCountries?: string[];
  selectedCities?: string[];
  selectedTowns?: string[];
  selectedOccasions?: string[];
  selectedTags?: string[];
  selectedPrices?: string[];
}

export interface ListFilterMatchablePlace {
  name: string;
  city: string | null;
  country?: string | null;
  address: string | null;
  notes?: string | null;
  priceRange: string;
  occasions: string[];
  tags: string[];
}

export function sanitizeListFilterCriteria(
  raw?: ListFilterCriteria | null
): ListFilterCriteria | null {
  if (!raw) return null;
  const cleanArr = (arr?: string[]) =>
    Array.from(new Set((arr || []).map((v) => v.trim()).filter(Boolean)));

  const criteria: ListFilterCriteria = {};
  const textSearch = (raw.textSearch || "").trim();
  if (textSearch) criteria.textSearch = textSearch;

  const countries = cleanArr(raw.selectedCountries);
  if (countries.length > 0) criteria.selectedCountries = countries;

  const cities = cleanArr(raw.selectedCities);
  if (cities.length > 0) criteria.selectedCities = cities;

  const towns = cleanArr(raw.selectedTowns);
  if (towns.length > 0) criteria.selectedTowns = towns;

  const occasions = cleanArr(raw.selectedOccasions);
  if (occasions.length > 0) criteria.selectedOccasions = occasions;

  const tags = cleanArr(raw.selectedTags).map((t) => t.toLowerCase());
  if (tags.length > 0) criteria.selectedTags = tags;

  const prices = cleanArr(raw.selectedPrices);
  if (prices.length > 0) criteria.selectedPrices = prices;

  return Object.keys(criteria).length > 0 ? criteria : null;
}

export function hasActiveListFilters(criteria?: ListFilterCriteria | null): boolean {
  return sanitizeListFilterCriteria(criteria) !== null;
}

export function matchesListFilterCriteria(
  place: ListFilterMatchablePlace,
  rawCriteria?: ListFilterCriteria | null
): boolean {
  const criteria = sanitizeListFilterCriteria(rawCriteria);
  if (!criteria) return false;

  if (criteria.textSearch) {
    const q = normalizeSearchText(criteria.textSearch);
    const tokens = q.split(/\s+/).filter(Boolean);
    const searchable = normalizeSearchText(
      [
        place.name,
        place.city || "",
        place.country || "",
        place.address || "",
        place.notes || "",
        ...place.occasions,
        ...place.tags,
      ].join(" ")
    );
    const matchesText =
      searchable.includes(q) ||
      (tokens.length > 1 && tokens.every((tok) => searchable.includes(tok)));
    if (!matchesText) return false;
  }

  if (criteria.selectedOccasions && criteria.selectedOccasions.length > 0) {
    if (!place.occasions.some((occ) => criteria.selectedOccasions!.includes(occ))) {
      return false;
    }
  }

  if (criteria.selectedTags && criteria.selectedTags.length > 0) {
    const lowerTags = place.tags.map((t) => t.toLowerCase());
    if (!criteria.selectedTags.every((t) => lowerTags.includes(t.toLowerCase()))) {
      return false;
    }
  }

  if (criteria.selectedPrices && criteria.selectedPrices.length > 0) {
    if (!criteria.selectedPrices.includes(place.priceRange) && place.priceRange !== "???") {
      return false;
    }
  }

  if (criteria.selectedCountries && criteria.selectedCountries.length > 0) {
    const country = place.country || parseCityCountry(place.city, place.address).country;
    if (!criteria.selectedCountries.includes(country)) {
      return false;
    }
  }

  if (criteria.selectedCities && criteria.selectedCities.length > 0) {
    const filterCity = resolveFilterCity(place.city, place.address, place.country);
    if (!criteria.selectedCities.includes(filterCity)) {
      return false;
    }
  }

  if (criteria.selectedTowns && criteria.selectedTowns.length > 0) {
    const town = parseCityCountry(place.city, place.address).city.trim();
    if (!criteria.selectedTowns.includes(town)) {
      return false;
    }
  }

  return true;
}

export function summarizeListFilterCriteria(criteria?: ListFilterCriteria | null): string[] {
  const clean = sanitizeListFilterCriteria(criteria);
  if (!clean) return [];
  const chips: string[] = [];
  if (clean.selectedCities?.length) chips.push(`📍 ${clean.selectedCities.join(", ")}`);
  if (clean.selectedTowns?.length) chips.push(`🏘️ ${clean.selectedTowns.join(", ")}`);
  if (clean.selectedCountries?.length) chips.push(`🌍 ${clean.selectedCountries.join(", ")}`);
  if (clean.selectedOccasions?.length) chips.push(`🍽️ ${clean.selectedOccasions.join(", ")}`);
  if (clean.selectedTags?.length) chips.push(`🏷️ ${clean.selectedTags.map((t) => `#${t}`).join(" ")}`);
  if (clean.selectedPrices?.length) chips.push(`💶 ${clean.selectedPrices.join(", ")}`);
  if (clean.textSearch) chips.push(`🔎 "${clean.textSearch}"`);
  return chips;
}
