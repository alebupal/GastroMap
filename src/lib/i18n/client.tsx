"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "./config";
import { translate, type Messages } from "./messages";

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const router = useRouter();

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(messages, key, params),
    [messages]
  );

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    },
    [router]
  );

  const value = useMemo(() => ({ locale, messages, t, setLocale }), [locale, messages, t, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fuera del proveedor devolvemos la clave para no romper el render
    return {
      locale: "es" as Locale,
      t: (key: string) => key,
      setLocale: () => {},
    };
  }
  return ctx;
}
