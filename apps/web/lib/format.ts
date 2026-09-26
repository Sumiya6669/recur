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

export function period(secs: bigint | number) {
  const s = Number(secs);
  const table: [number, string, string][] = [
    [365 * 86400, "year", "yearly"],
    [30 * 86400, "month", "monthly"],
    [7 * 86400, "week", "weekly"],
    [86400, "day", "daily"],
    [3600, "hour", "hourly"],
    [60, "minute", "every minute"],
  ];
  for (const [len, unit, adverb] of table) {
    if (s % len === 0) {
      const n = s / len;
      return {
        every: n === 1 ? unit : `${n} ${unit}s`,
        span: `${n} ${unit}${n === 1 ? "" : "s"}`,
        adverb: n === 1 ? adverb : `every ${n} ${unit}s`,
      };
    }
  }
  const label = `${s} second${s === 1 ? "" : "s"}`;
  return { every: label, span: label, adverb: `every ${label}` };
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function relative(targetSecs: bigint | number, nowSecs: number = Date.now() / 1000) {
  const d = Number(targetSecs) - nowSecs;
  const a = Math.abs(d);
  if (a < 60) return rtf.format(Math.round(d), "second");
  if (a < 3600) return rtf.format(Math.round(d / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(d / 3600), "hour");
  if (a < 86400 * 45) return rtf.format(Math.round(d / 86400), "day");
  return rtf.format(Math.round(d / (86400 * 30)), "month");
}

export const dateTime = (secs: bigint | number) =>
  new Date(Number(secs) * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const nowSecs = () => BigInt(Math.floor(Date.now() / 1000));

/** Monthly-normalised value of a recurring amount. */
export const monthly = (amount: bigint, periodSecs: bigint) => (Number(amount) / 1e6) * (2_592_000 / Number(periodSecs));
