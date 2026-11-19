import es from "@/locales/es.json";
import en from "@/locales/en.json";
import { DEFAULT_LOCALE, FALLBACK_LOCALE, type Locale } from "./config";

export type Messages = Record<string, string>;

function flatten(obj: unknown, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  if (!obj || typeof obj !== "object") return result;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flatten(value, fullKey));
    } else if (typeof value === "string") {
      result[fullKey] = value;
    }
  }
  return result;
}

// Registro estático: al añadir un idioma, importa su JSON aquí.
const ALL: Record<Locale, Messages> = {
  es: flatten(es),
  en: flatten(en),
};

export function getMessages(locale: Locale): Messages {
  return ALL[locale] ?? ALL[DEFAULT_LOCALE];
}

export function getLocaleNames(): Array<{ code: Locale; name: string }> {
  return (Object.keys(ALL) as Locale[]).map((code) => ({
    code,
    name: ALL[code]["meta.name"] || (code === "es" ? "Español" : "English"),
  }));
}

/** Traduce una clave con interpolación {param}. Cae a FALLBACK_LOCALE y luego a la propia clave. */
export function translate(
  messages: Messages,
  key: string,
  params?: Record<string, string | number>
): string {
  let text = messages[key] ?? ALL[FALLBACK_LOCALE]?.[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
