import { en, type Dict } from "./en";
import { ru } from "./ru";
import { kk } from "./kk";
import type { Locale } from "./locales";

export type { Dict };
export const dictionaries: Record<Locale, Dict> = { en, ru, kk };
