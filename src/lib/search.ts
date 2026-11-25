/**
 * Normaliza texto para búsquedas insensibles a mayúsculas y tildes/diacríticos.
 * Ejemplo: "Alegría" y "alegria" producen ambos "alegria".
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Comprueba si `haystack` contiene `needle` ignorando mayúsculas y tildes/diacríticos.
 */
export function matchesSearch(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  const q = normalizeSearchText(needle);
  if (!q) return true;
  return normalizeSearchText(haystack).includes(q);
}
