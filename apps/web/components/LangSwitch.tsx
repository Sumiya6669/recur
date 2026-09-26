"use client";
import { useT } from "@/lib/i18n/client";
import { LOCALES, LOCALE_NAME, LOCALE_SHORT } from "@/lib/i18n/locales";

/** Compact EN / RU / KZ switch. The choice is stored in the `lang` cookie and the page re-renders on the server. */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useT();
  return (
    <div role="group" aria-label={t.common.language} className={`flex items-center rounded-full border border-line p-0.5 text-[12px] ${className}`}>
      {LOCALES.map((l) => (
        <button key={l} onClick={() => l !== locale && setLocale(l)} aria-pressed={l === locale} title={LOCALE_NAME[l]} lang={l}
          className={`rounded-full px-2 py-1 font-medium transition-colors ${l === locale ? "bg-raise text-fg" : "text-dim hover:text-fg"}`}>
          {LOCALE_SHORT[l]}
        </button>
      ))}
    </div>
  );
}
