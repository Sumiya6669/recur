import {
  getAddressDecoder,
  getBase58Decoder,
  getBase64Encoder,
  type Address,
  type Rpc,
  type SolanaRpcApiMainnet,
} from "@solana/kit";
import { getTokenDecoder } from "@solana-program/token";
import { DISCRIMINATORS, RECUR_PROGRAM_ID, decodeName, findDelegatePda } from "./program.ts";

export type MerchantAccount = {
  address: Address;
  authority: Address;
  settlementWallet: Address;
  planCount: bigint;
  name: string;
};

export type PlanAccount = {
  address: Address;
  merchant: Address;
  id: bigint;
  mint: Address;
  amount: bigint;
  periodSecs: bigint;
  graceSecs: bigint;
  active: boolean;
  subscriberCount: bigint;
  name: string;
};

export type SubscriptionAccount = {
  address: Address;
  plan: Address;
  merchant: Address;
  subscriber: Address;
  subscriberTokenAccount: Address;
  mint: Address;
  amount: bigint;
  periodSecs: bigint;
  graceSecs: bigint;
  createdAt: bigint;
  lastChargedAt: bigint;
  nextChargeAt: bigint;
  cyclesPaid: bigint;
  /** 0n = until cancelled */
  maxCycles: bigint;
  /** Most this subscription may still collect; `charge` spends it, `extend` raises it. */
  budgetRemaining: bigint;
};

// Byte layouts (Anchor, 8-byte discriminator first)
export const MERCHANT_SIZE = 113;
export const PLAN_SIZE = 146;
export const SUBSCRIPTION_SIZE = 241;
export const OFFSETS = {
  plan: { merchant: 8 },
  subscription: { plan: 8, merchant: 40, subscriber: 72 },
} as const;

const addrDec = getAddressDecoder();
const b58 = getBase58Decoder();
const b64 = getBase64Encoder();

const view = (d: Uint8Array) => new DataView(d.buffer, d.byteOffset, d.byteLength);
const addrAt = (d: Uint8Array, o: number) => addrDec.decode(d.subarray(o, o + 32));
const hasDisc = (d: Uint8Array, disc: readonly number[]) => disc.every((b, i) => d[i] === b);

export function decodeMerchant(address: Address, d: Uint8Array): MerchantAccount {
  if (!hasDisc(d, DISCRIMINATORS.Merchant)) throw new Error("Not a Merchant account");
  return {
    address,
    authority: addrAt(d, 8),
    settlementWallet: addrAt(d, 40),
    planCount: view(d).getBigUint64(72, true),
    name: decodeName(d.subarray(80, 112)),
  };
}

export function decodePlan(address: Address, d: Uint8Array): PlanAccount {
  if (!hasDisc(d, DISCRIMINATORS.Plan)) throw new Error("Not a Plan account");
  const v = view(d);
  return {
    address,
    merchant: addrAt(d, 8),
    id: v.getBigUint64(40, true),
    mint: addrAt(d, 48),
    amount: v.getBigUint64(80, true),
    periodSecs: v.getBigInt64(88, true),
    graceSecs: v.getBigInt64(96, true),
    active: d[104] === 1,
    subscriberCount: v.getBigUint64(105, true),
    name: decodeName(d.subarray(113, 145)),
  };
}

export function decodeSubscription(address: Address, d: Uint8Array): SubscriptionAccount {
  if (!hasDisc(d, DISCRIMINATORS.Subscription)) throw new Error("Not a Subscription account");
  const v = view(d);
  return {
    address,
    plan: addrAt(d, 8),
    merchant: addrAt(d, 40),
    subscriber: addrAt(d, 72),
    subscriberTokenAccount: addrAt(d, 104),
    mint: addrAt(d, 136),
    amount: v.getBigUint64(168, true),
    periodSecs: v.getBigInt64(176, true),
    graceSecs: v.getBigInt64(184, true),
    createdAt: v.getBigInt64(192, true),
    lastChargedAt: v.getBigInt64(200, true),
    nextChargeAt: v.getBigInt64(208, true),
    cyclesPaid: v.getBigUint64(216, true),
    maxCycles: v.getBigUint64(224, true),
    // offset 232 is the bump; the budget was appended after it
    budgetRemaining: v.getBigUint64(233, true),
  };
}

// ------------------------------------------------------------------ RPC fetchers

type AnyRpc = Rpc<SolanaRpcApiMainnet>;
const bytesOf = (data: readonly [string, string] | readonly unknown[]) =>
  new Uint8Array(b64.encode(data[0] as string));

async function programAccounts(
  rpc: AnyRpc,
  disc: readonly number[],
  size: number,
  extra: { offset: number; address: Address }[] = [],
) {
  const res = await rpc
    .getProgramAccounts(RECUR_PROGRAM_ID, {
      encoding: "base64",
      filters: [
        { dataSize: BigInt(size) },
        { memcmp: { offset: 0n, bytes: b58.decode(Uint8Array.from(disc)) as never, encoding: "base58" } },
        ...extra.map((f) => ({
          memcmp: { offset: BigInt(f.offset), bytes: f.address as never, encoding: "base58" as const },
        })),
      ],
    })
    .send();
  return (res as unknown as { pubkey: Address; account: { data: [string, string] } }[]).map((a) => ({
    address: a.pubkey,
    data: bytesOf(a.account.data),
  }));
}

export async function fetchMaybeAccountBytes(rpc: AnyRpc, address: Address) {
  const { value } = await rpc.getAccountInfo(address, { encoding: "base64" }).send();
  return value ? { data: bytesOf(value.data as [string, string]), owner: value.owner as Address } : null;
}

export async function fetchMultipleAccountBytes(rpc: AnyRpc, addresses: Address[]) {
  const out: ({ data: Uint8Array; owner: Address } | null)[] = [];
  for (let i = 0; i < addresses.length; i += 100) {
    const { value } = await rpc
      .getMultipleAccounts(addresses.slice(i, i + 100), { encoding: "base64" })
      .send();
    for (const v of value) out.push(v ? { data: bytesOf(v.data as [string, string]), owner: v.owner as Address } : null);
  }
  return out;
}

export async function fetchMerchant(rpc: AnyRpc, address: Address) {
  const a = await fetchMaybeAccountBytes(rpc, address);
  return a ? decodeMerchant(address, a.data) : null;
}
export async function fetchPlan(rpc: AnyRpc, address: Address) {
  const a = await fetchMaybeAccountBytes(rpc, address);
  return a ? decodePlan(address, a.data) : null;
}
export async function fetchSubscription(rpc: AnyRpc, address: Address) {
  const a = await fetchMaybeAccountBytes(rpc, address);
  return a ? decodeSubscription(address, a.data) : null;
}

export const fetchPlansByMerchant = async (rpc: AnyRpc, merchant: Address) =>
  (await programAccounts(rpc, DISCRIMINATORS.Plan, PLAN_SIZE, [{ offset: OFFSETS.plan.merchant, address: merchant }]))
    .map((a) => decodePlan(a.address, a.data))
    .sort((x, y) => Number(x.id - y.id));

export const fetchSubscriptionsByMerchant = async (rpc: AnyRpc, merchant: Address) =>
  (
    await programAccounts(rpc, DISCRIMINATORS.Subscription, SUBSCRIPTION_SIZE, [
      { offset: OFFSETS.subscription.merchant, address: merchant },
    ])
  ).map((a) => decodeSubscription(a.address, a.data));

export const fetchSubscriptionsBySubscriber = async (rpc: AnyRpc, subscriber: Address) =>
  (
    await programAccounts(rpc, DISCRIMINATORS.Subscription, SUBSCRIPTION_SIZE, [
      { offset: OFFSETS.subscription.subscriber, address: subscriber },
    ])
  ).map((a) => decodeSubscription(a.address, a.data));

export const fetchAllSubscriptions = async (rpc: AnyRpc) =>
  (await programAccounts(rpc, DISCRIMINATORS.Subscription, SUBSCRIPTION_SIZE)).map((a) =>
    decodeSubscription(a.address, a.data),
  );

// ------------------------------------------------------------------ status & health

export type SubscriptionStatus = "active" | "past_due" | "lapsed" | "completed";

export const isCompleted = (s: Pick<SubscriptionAccount, "maxCycles" | "cyclesPaid">) =>
  s.maxCycles > 0n && s.cyclesPaid >= s.maxCycles;

/**
 * active   — paid for the current period
 * past_due — payment is due, still inside the grace period (access continues)
 * lapsed   — grace period is over (revoke access)
 * completed— all scheduled payments collected; access lasts until the last period ends
 */
export function getSubscriptionStatus(s: SubscriptionAccount, nowSecs: bigint): SubscriptionStatus {
  if (isCompleted(s)) return nowSecs < s.nextChargeAt ? "completed" : "lapsed";
  if (nowSecs < s.nextChargeAt) return "active";
  if (nowSecs < s.nextChargeAt + s.graceSecs) return "past_due";
  return "lapsed";
}

/** Access check for merchants: should this subscriber have access right now? */
export const hasAccess = (s: SubscriptionAccount, nowSecs: bigint) => {
  const st = getSubscriptionStatus(s, nowSecs);
  return st === "active" || st === "past_due" || st === "completed";
};

export type TokenAccountState = { owner: Address; amount: bigint; delegate: Address | null; delegatedAmount: bigint };

export function decodeTokenAccount(d: Uint8Array): TokenAccountState {
  const t = getTokenDecoder().decode(d.subarray(0, 165));
  return {
    owner: t.owner,
    amount: t.amount,
    delegate: t.delegate.__option === "Some" ? t.delegate.value : null,
    delegatedAmount: t.delegatedAmount,
  };
}

export type PaymentHealth = "ok" | "delegate_missing" | "allowance_low" | "balance_low";

/** Will the next charge for this subscription succeed, given the subscriber's token account? */
export async function getPaymentHealth(s: SubscriptionAccount, token: TokenAccountState | null): Promise<PaymentHealth> {
  if (!token) return "balance_low";
  const delegate = await findDelegatePda();
  if (token.delegate !== delegate) return "delegate_missing";
  if (s.budgetRemaining < s.amount || token.delegatedAmount < s.amount) return "allowance_low";
  if (token.amount < s.amount) return "balance_low";
  return "ok";
}
