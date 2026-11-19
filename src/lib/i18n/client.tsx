"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "./config";
import { getMessages, translate, type Messages } from "./messages";

interface I18nContextValue {
  locale: Locale;
  messages: Messages;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale: initialLocale,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState<Locale>(initialLocale);

  const messages = useMemo(() => {
    return getMessages(currentLocale);
  }, [currentLocale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(messages, key, params),
    [messages]
  );

  const setLocale = useCallback(
    (next: Locale) => {
      setCurrentLocale(next);
      if (typeof document !== "undefined") {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      }
      router.refresh();
    },
    [router]
  );

  const value = useMemo(
    () => ({ locale: currentLocale, messages, t, setLocale }),
    [currentLocale, messages, t, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "es" as Locale,
      t: (key: string) => key,
      setLocale: () => {},
    };
  }
  return ctx;
}
