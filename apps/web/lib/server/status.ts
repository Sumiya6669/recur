import "server-only";
import { address, createKeyPairSignerFromBytes, getBase58Encoder, type Address } from "@solana/kit";
import { RECUR_PROGRAM_ID, fetchAllSubscriptions, getSubscriptionStatus } from "@recur/sdk";
import { serverRpc } from "./rpc";

/** Below this the keeper can't pay fees for long. One charge costs ~0.00001 SOL. */
export const KEEPER_LOW_LAMPORTS = 50_000_000n;
/** A due payment older than this with no keeper activity means the schedule isn't running. */
const LAG_SECS = 10 * 60;

export type ProblemCode = "notDeployed" | "keeperLow" | "noKeeper" | "lagging";

export type Status = {
  ok: boolean;
  checkedAt: number;
  cluster: string;
  program: { address: Address; deployed: boolean };
  keeper: { address: Address | null; lamports: string | null; low: boolean; lastActivityAt: number | null };
  subscriptions: { total: number; active: number; pastDue: number; lapsed: number; completed: number; oldestDueAt: number | null };
  problems: ProblemCode[];
};

async function keeperAddress(): Promise<Address | null> {
  const raw = process.env.KEEPER_SECRET_KEY?.trim();
  if (!raw) return null;
  const bytes = raw.startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : new Uint8Array(getBase58Encoder().encode(raw));
  return (await createKeyPairSignerFromBytes(bytes)).address;
}

// Per-instance cache so a burst of page views or monitor pings costs one round of RPC calls.
let cached: { at: number; value: Promise<Status> } | null = null;
const CACHE_MS = 20_000;

export function getStatus(): Promise<Status> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  const value = computeStatus();
  cached = { at: Date.now(), value };
  value.catch(() => { cached = null; });
  return value;
}

async function computeStatus(): Promise<Status> {
  const rpc = serverRpc();
  const now = Math.floor(Date.now() / 1000);
  const problems: ProblemCode[] = [];

  const [programInfo, subs, keeper] = await Promise.all([
    rpc.getAccountInfo(RECUR_PROGRAM_ID, { encoding: "base64", dataSlice: { offset: 0, length: 0 } }).send(),
    fetchAllSubscriptions(rpc),
    keeperAddress().catch(() => null),
  ]);
  const deployed = !!programInfo.value?.executable;
  if (!deployed) problems.push("notDeployed");

  let lamports: bigint | null = null;
  let lastActivityAt: number | null = null;
  if (keeper) {
    const [bal, sigs] = await Promise.all([
      rpc.getBalance(keeper).send(),
      rpc.getSignaturesForAddress(keeper, { limit: 1 }).send(),
    ]);
    lamports = bal.value;
    lastActivityAt = sigs[0]?.blockTime != null ? Number(sigs[0].blockTime) : null;
    if (lamports < KEEPER_LOW_LAMPORTS) problems.push("keeperLow");
  } else {
    problems.push("noKeeper");
  }

  const counts = { active: 0, pastDue: 0, lapsed: 0, completed: 0 };
  let oldestDueAt: number | null = null;
  for (const s of subs) {
    const st = getSubscriptionStatus(s, BigInt(now));
    if (st === "active") counts.active++;
    else if (st === "past_due") {
      counts.pastDue++;
      const due = Number(s.nextChargeAt);
      oldestDueAt = oldestDueAt === null ? due : Math.min(oldestDueAt, due);
    } else if (st === "lapsed") counts.lapsed++;
    else counts.completed++;
  }
  // Past-due can also mean the subscriber's wallet is empty; only flag it when the keeper looks idle too.
  if (oldestDueAt !== null && now - oldestDueAt > LAG_SECS && (lastActivityAt === null || now - lastActivityAt > LAG_SECS)) {
    problems.push("lagging");
  }

  return {
    ok: problems.length === 0,
    checkedAt: now,
    cluster: process.env.NEXT_PUBLIC_CLUSTER ?? "devnet",
    program: { address: address(RECUR_PROGRAM_ID), deployed },
    keeper: { address: keeper, lamports: lamports?.toString() ?? null, low: lamports !== null && lamports < KEEPER_LOW_LAMPORTS, lastActivityAt },
    subscriptions: { total: subs.length, ...counts, oldestDueAt },
    problems,
  };
}
