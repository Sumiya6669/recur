import { dictionaries } from "./i18n/dictionaries";
import type { Locale } from "./i18n/locales";

/** Turns wallet, RPC and program errors into one sentence in the user's language. */
export function explain(err: unknown, locale: Locale = "en"): string {
  const t = dictionaries[locale].txErrors;
  const msg = err instanceof Error ? err.message : String(err);
  if (/User rejected|rejected the request|declined/i.test(msg)) return t.declined;
  if (msg.includes("INSUFFICIENT_BALANCE")) return t.insufficientBalance;
  if (msg.includes("NO_TOKEN_ACCOUNT")) return t.noTokenAccount;
  if (msg.includes("ALREADY_SUBSCRIBED")) return t.alreadySubscribed;
  if (/insufficient lamports|insufficient funds for (fee|rent)|AccountNotFound|debit an account/i.test(msg)) return t.noSol;
  const custom = msg.match(/"Custom":\s*(\d+)|custom program error: 0x([0-9a-f]+)/i);
  if (custom) {
    const code = custom[1] ? Number(custom[1]) : parseInt(custom[2], 16);
    if (t.program[code]) return t.program[code];
  }
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}
