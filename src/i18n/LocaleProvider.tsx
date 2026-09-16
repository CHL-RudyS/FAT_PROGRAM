"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ID_EN } from "@/i18n/dictionary";

export type Locale = "ID" | "EN";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (text: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale = "ID",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.cookie = `chl_locale=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (text: string) => (locale === "EN" ? (ID_EN[text.trim()] ?? text) : text),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside LocaleProvider");
  return ctx;
}

/** Shorthand for components that only need the translate function. */
export function useT() {
  return useLocale().t;
}
