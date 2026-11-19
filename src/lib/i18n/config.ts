/**
 * Configuración de idiomas. Para añadir uno nuevo:
 *   1. `npm run i18n:export` → genera src/locales/translations.csv
 *   2. Añade una columna con el código (ej. `fr`) y traduce
 *   3. `npm run i18n:import` → regenera los JSON
 *   4. Añade el código a LOCALES (y su nombre en `meta.name` del CSV)
 */
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";
export const FALLBACK_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "gastromap_lang";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
