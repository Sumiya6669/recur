import { INTL, type Locale } from "./i18n/locales";

const nf = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const usdc = (base: bigint | number, decimals = 6) => {
  const v = typeof base === "bigint" ? Number(base) / 10 ** decimals : base;
  return v >= 10_000 ? nf0.format(v) : nf.format(v);
};
/** Dollar amount for dashboard figures: cents below $1,000, whole dollars above. */
export const money = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: v >= 1000 ? 0 : 2 })}`;

export const usdcNum = (base: bigint, decimals = 6) => Number(base) / 10 ** decimals;

export const short = (a: string, n = 4) => (a.length > 2 * n + 1 ? `${a.slice(0, n)}…${a.slice(-n)}` : a);

type Unit = "year" | "month" | "week" | "day" | "hour" | "minute" | "second";
const UNITS: [Unit, number][] = [
  ["year", 365 * 86400], ["month", 30 * 86400], ["week", 7 * 86400], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1],
];

// Russian needs three plural forms and the accusative singular for durations ("на 1 неделю").
const RU: Record<Unit, { forms: [string, string, string]; acc: string; every1: string }> = {
  year: { forms: ["год", "года", "лет"], acc: "год", every1: "ежегодно" },
  month: { forms: ["месяц", "месяца", "месяцев"], acc: "месяц", every1: "ежемесячно" },
  week: { forms: ["неделя", "недели", "недель"], acc: "неделю", every1: "еженедельно" },
  day: { forms: ["день", "дня", "дней"], acc: "день", every1: "ежедневно" },
  hour: { forms: ["час", "часа", "часов"], acc: "час", every1: "каждый час" },
  minute: { forms: ["минута", "минуты", "минут"], acc: "минуту", every1: "каждую минуту" },
  second: { forms: ["секунда", "секунды", "секунд"], acc: "секунду", every1: "каждую секунду" },
};
const ruPlural = new Intl.PluralRules("ru-RU");
const ruForm = (u: Unit, n: number) => {
  const r = ruPlural.select(n);
  return RU[u].forms[r === "one" ? 0 : r === "few" ? 1 : 2];
};
// Kazakh nouns don't change after numerals.
const KK: Record<Unit, string> = { year: "жыл", month: "ай", week: "апта", day: "күн", hour: "сағат", minute: "минут", second: "секунд" };
const EN_ADVERB: Partial<Record<Unit, string>> = { year: "yearly", month: "monthly", week: "weekly", day: "daily", hour: "hourly", minute: "every minute" };

/**
 * Human labels for a period in seconds.
 * every: after a slash ("USDC / month"), span: a length ("3 days"), spanFor: a length inside a sentence
 * (Russian accusative, "1 неделю"), adverb: how often ("monthly", "every 2 minutes").
 */
export function period(secs: bigint | number, locale: Locale = "en") {
  const s = Number(secs);
  const [unit, len] = UNITS.find(([, l]) => s % l === 0) ?? ["second", 1];
  const n = s / len;
  if (locale === "ru") {
    const form = ruForm(unit, n);
    return {
      every: n === 1 ? RU[unit].forms[0] : `${n} ${form}`,
      span: `${n} ${form}`,
      spanFor: n === 1 ? `1 ${RU[unit].acc}` : `${n} ${form}`,
      adverb: n === 1 ? RU[unit].every1 : `каждые ${n} ${form}`,
    };
  }
  if (locale === "kk") {
    const w = KK[unit];
    return { every: n === 1 ? w : `${n} ${w}`, span: `${n} ${w}`, spanFor: `${n} ${w}`, adverb: n === 1 ? `${w} сайын` : `${n} ${w} сайын` };
  }
  const plural = `${unit}${n === 1 ? "" : "s"}`;
  return {
    every: n === 1 ? unit : `${n} ${plural}`,
    span: `${n} ${plural}`,
    spanFor: `${n} ${plural}`,
    adverb: n === 1 ? EN_ADVERB[unit] ?? `every ${unit}` : `every ${n} ${plural}`,
  };
}

const rtfCache = new Map<Locale, Intl.RelativeTimeFormat>();
const rtf = (l: Locale) => {
  let f = rtfCache.get(l);
  if (!f) {
    try { f = new Intl.RelativeTimeFormat(INTL[l], { numeric: "auto" }); } catch { f = new Intl.RelativeTimeFormat("en", { numeric: "auto" }); }
    rtfCache.set(l, f);
  }
  return f;
};
export function relative(targetSecs: bigint | number, nowSecs: number = Date.now() / 1000, locale: Locale = "en") {
  const d = Number(targetSecs) - nowSecs;
  const a = Math.abs(d);
  const f = rtf(locale);
  if (a < 60) return f.format(Math.round(d), "second");
  if (a < 3600) return f.format(Math.round(d / 60), "minute");
  if (a < 86400) return f.format(Math.round(d / 3600), "hour");
  if (a < 86400 * 45) return f.format(Math.round(d / 86400), "day");
  return f.format(Math.round(d / (86400 * 30)), "month");
}

export const dateTime = (secs: bigint | number, locale: Locale = "en") =>
  new Date(Number(secs) * 1000).toLocaleString(INTL[locale], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const nowSecs = () => BigInt(Math.floor(Date.now() / 1000));

/** Monthly-normalised value of a recurring amount. */
export const monthly = (amount: bigint, periodSecs: bigint) => (Number(amount) / 1e6) * (2_592_000 / Number(periodSecs));
