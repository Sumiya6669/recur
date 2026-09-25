import { type Address, type Rpc, type SolanaRpcApiMainnet, type TransactionSigner } from "@solana/kit";
import { findAssociatedTokenPda } from "@solana-program/token";
import {
  decodeMerchant,
  decodeTokenAccount,
  fetchAllSubscriptions,
  fetchMultipleAccountBytes,
  getPaymentHealth,
  isCompleted,
  type SubscriptionAccount,
} from "./accounts.ts";
import { sendAndConfirm } from "./flows.ts";
import { getChargeInstruction } from "./program.ts";

type AnyRpc = Rpc<SolanaRpcApiMainnet>;

export type RecurEventType =
  | "payment.succeeded"
  | "payment.failed"
  | "payment.at_risk"
  | "subscription.completed";

export type RecurEvent = {
  id: string;
  type: RecurEventType;
  created: number;
  data: {
    subscription: Address;
    plan: Address;
    merchant: Address;
    subscriber: Address;
    mint: Address;
    amount: string;
    cycle?: string;
    next_charge_at?: number;
    signature?: string;
    reason?: string;
  };
};

export type EventSink = (event: RecurEvent) => Promise<void> | void;

export const consoleSink: EventSink = (e) => console.log(JSON.stringify(e));

/**
 * POSTs events as JSON. Header `x-recur-signature: t=<unix>,v1=<hex hmac-sha256("<t>.<body>")>`
 * lets the receiver verify authenticity (see docs/webhooks.md).
 */
export function webhookSink(url: string, secret: string): EventSink {
  return async (e) => {
    const body = JSON.stringify(e);
    const t = Math.floor(Date.now() / 1000);
    const sig = await hmacHex(secret, `${t}.${body}`);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-recur-signature": `t=${t},v1=${sig}` },
        body,
      });
      if (!res.ok) console.warn(`webhook ${res.status} for ${e.id}`);
    } catch (err) {
      console.warn(`webhook delivery failed for ${e.id}:`, (err as Error).message);
    }
  };
}

export async function hmacHex(secret: string, payload: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Dedupes warning events within one process (a DB-backed store replaces this with Supabase).
const emitted = new Set<string>();

export type KeeperResult = {
  checked: number;
  due: number;
  charged: { subscription: Address; signature: string }[];
  skipped: { subscription: Address; reason: string }[];
  errors: { subscription: Address; error: string }[];
};

export async function runKeeperPass(opts: {
  rpc: AnyRpc;
  keeper: TransactionSigner;
  sink?: EventSink;
  /** Warn about payments due within this window (seconds). */
  lookaheadSecs?: bigint;
  maxCharges?: number;
  nowSecs?: bigint;
}): Promise<KeeperResult> {
  const { rpc, keeper } = opts;
  const sink = opts.sink ?? consoleSink;
  const now = opts.nowSecs ?? BigInt(Math.floor(Date.now() / 1000));
  const lookahead = opts.lookaheadSecs ?? 86_400n;
  const result: KeeperResult = { checked: 0, due: 0, charged: [], skipped: [], errors: [] };

  const subs = (await fetchAllSubscriptions(rpc)).filter((s) => !isCompleted(s));
  result.checked = subs.length;
  const relevant = subs.filter((s) => s.nextChargeAt <= now + lookahead);
  if (relevant.length === 0) return result;

  // Batch-load token accounts, merchants and mint owners (token program)
  const tokenAccs = await fetchMultipleAccountBytes(rpc, relevant.map((s) => s.subscriberTokenAccount));
  const merchantAddrs = [...new Set(relevant.map((s) => s.merchant))];
  const mintAddrs = [...new Set(relevant.map((s) => s.mint))];
  const [merchantAccs, mintAccs] = await Promise.all([
    fetchMultipleAccountBytes(rpc, merchantAddrs),
    fetchMultipleAccountBytes(rpc, mintAddrs),
  ]);
  const merchants = new Map(merchantAddrs.map((a, i) => [a, merchantAccs[i] ? decodeMerchant(a, merchantAccs[i]!.data) : null]));
  const tokenPrograms = new Map(mintAddrs.map((a, i) => [a, mintAccs[i]?.owner ?? null]));

  const event = (type: RecurEventType, s: SubscriptionAccount, extra: Partial<RecurEvent["data"]> = {}): RecurEvent => ({
    id: `evt_${s.address.slice(0, 8)}_${s.nextChargeAt}_${type}`,
    type,
    created: Math.floor(Date.now() / 1000),
    data: {
      subscription: s.address,
      plan: s.plan,
      merchant: s.merchant,
      subscriber: s.subscriber,
      mint: s.mint,
      amount: s.amount.toString(),
      next_charge_at: Number(s.nextChargeAt),
      ...extra,
    },
  });
  const emitOnce = async (e: RecurEvent) => {
    if (emitted.has(e.id)) return;
    emitted.add(e.id);
    await sink(e);
  };

  let charges = 0;
  for (let i = 0; i < relevant.length; i++) {
    const s = relevant[i];
    const token = tokenAccs[i] ? decodeTokenAccount(tokenAccs[i]!.data) : null;
    const health = await getPaymentHealth(s, token);
    const isDue = s.nextChargeAt <= now;

    if (!isDue) {
      if (health !== "ok") await emitOnce(event("payment.at_risk", s, { reason: health }));
      continue;
    }
    result.due++;

    if (health !== "ok") {
      result.skipped.push({ subscription: s.address, reason: health });
      await emitOnce(event("payment.failed", s, { reason: health }));
      continue;
    }
    if (opts.maxCharges !== undefined && charges >= opts.maxCharges) {
      result.skipped.push({ subscription: s.address, reason: "max_charges_reached" });
      continue;
    }

    const merchant = merchants.get(s.merchant);
    const tokenProgram = tokenPrograms.get(s.mint);
    if (!merchant || !tokenProgram) {
      result.errors.push({ subscription: s.address, error: "merchant_or_mint_missing" });
      continue;
    }

    try {
      const [merchantAta] = await findAssociatedTokenPda({ owner: merchant.settlementWallet, mint: s.mint, tokenProgram });
      const ix = await getChargeInstruction({
        cranker: keeper,
        merchant: s.merchant,
        subscription: s.address,
        mint: s.mint,
        subscriberTokenAccount: s.subscriberTokenAccount,
        merchantTokenAccount: merchantAta,
        tokenProgram,
      });
      const signature = await sendAndConfirm(rpc, keeper, [ix]);
      charges++;
      result.charged.push({ subscription: s.address, signature });
      const cycle = s.cyclesPaid + 1n;
      const base = now > s.nextChargeAt + s.graceSecs ? now : s.nextChargeAt;
      await sink(
        event("payment.succeeded", s, {
          signature,
          cycle: cycle.toString(),
          next_charge_at: Number(base + s.periodSecs),
        }),
      );
      if (s.maxCycles > 0n && cycle >= s.maxCycles) await sink(event("subscription.completed", s, { signature }));
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      result.errors.push({ subscription: s.address, error: msg.slice(0, 300) });
    }
  }
  return result;
}
