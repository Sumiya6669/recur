"use client";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./locales";
import { dictionaries, type Dict } from "./dictionaries";

type I18n = { locale: Locale; t: Dict; setLocale: (l: Locale) => void };
const I18nContext = createContext<I18n>({ locale: DEFAULT_LOCALE, t: dictionaries[DEFAULT_LOCALE], setLocale: () => {} });

/** The locale comes from the `lang` cookie, read by the root layout, so the first paint is already translated. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const setLocale = useCallback((l: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);
  const value = useMemo(() => ({ locale, t: dictionaries[locale], setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useT = () => useContext(I18nContext);
