export const LOCALES = ["en", "ru", "kk"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

/** Shown in the switcher. Kazakh uses the ISO 639-1 code `kk`, but people know it as KZ. */
export const LOCALE_SHORT: Record<Locale, string> = { en: "EN", ru: "RU", kk: "KZ" };
export const LOCALE_NAME: Record<Locale, string> = { en: "English", ru: "Русский", kk: "Қазақша" };
/** BCP 47 tags for Intl formatters. */
export const INTL: Record<Locale, string> = { en: "en-US", ru: "ru-RU", kk: "kk-KZ" };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
