import {
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
  SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_NOT_FOUND,
  SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_FEE,
  SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT,
  isSolanaError,
} from "@solana/kit";
import { dictionaries } from "./i18n/dictionaries";
import type { Locale } from "./i18n/locales";
import { CLUSTER } from "./config";

/** Everything an error carries: messages, causes, wallet-adapter wrappers and Solana error context (logs, codes). */
function collect(err: unknown, depth = 0): { text: string; chain: unknown[] } {
  if (err == null || depth > 4) return { text: "", chain: [] };
  const parts: string[] = [];
  const chain: unknown[] = [err];
  if (err instanceof Error) parts.push(err.message);
  else parts.push(String(err));
  const e = err as { cause?: unknown; error?: unknown; context?: unknown; logs?: unknown };
  const ctx = e.context ?? e.logs;
  if (ctx) {
    try { parts.push(JSON.stringify(ctx, (_, v) => (typeof v === "bigint" ? v.toString() : v))); } catch {}
  }
  for (const inner of [e.cause, e.error]) {
    const c = collect(inner, depth + 1);
    parts.push(c.text);
    chain.push(...c.chain);
  }
  return { text: parts.join("\n"), chain };
}

/** Turns wallet, RPC and program errors into one sentence in the user's language. */
export function explain(err: unknown, locale: Locale = "en"): string {
  const t = dictionaries[locale].txErrors;
  const noSol = CLUSTER === "mainnet" ? t.noSol : `${t.noSol} ${t.devnetSol}`;
  const { text, chain } = collect(err);

  for (const e of chain) {
    if (isSolanaError(e, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM) && t.program[e.context.code]) return t.program[e.context.code];
    if (
      isSolanaError(e, SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_NOT_FOUND) ||
      isSolanaError(e, SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_FEE) ||
      isSolanaError(e, SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT)
    ) return noSol;
  }

  if (/User rejected|rejected the request|declined/i.test(text)) return t.declined;
  if (text.includes("NO_SOL")) return noSol;
  if (text.includes("INSUFFICIENT_BALANCE")) return t.insufficientBalance;
  if (text.includes("NO_TOKEN_ACCOUNT")) return t.noTokenAccount;
  if (text.includes("ALREADY_SUBSCRIBED")) return t.alreadySubscribed;
  if (/insufficient lamports|insufficient funds for (fee|rent)|AccountNotFound|debit an account/i.test(text)) return noSol;
  const custom = text.match(/"Custom":\s*(\d+)|custom program error: 0x([0-9a-f]+)/i);
  if (custom) {
    const code = custom[1] ? Number(custom[1]) : parseInt(custom[2], 16);
    if (t.program[code]) return t.program[code];
  }
  if (chain.some((e) => isSolanaError(e, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE)) || /simulation failed/i.test(text)) {
    return t.simulationFailed;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}
