import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { getMessages, translate } from "./messages";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(value)) return value;

  try {
    const { getCurrentUser } = await import("@/lib/auth");
    const user = await getCurrentUser();
    if (user?.locale && isLocale(user.locale)) {
      return user.locale as Locale;
    }
  } catch {
    // Fallback si la base de datos o auth fallan
  }

  return DEFAULT_LOCALE;
}

/** Uso en Server Components / Server Actions: `const t = await getT(); t("key")` */
export async function getT() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return (key: string, params?: Record<string, string | number>) =>
    translate(messages, key, params);
}
