import { address, getAddressDecoder, type Address } from "@solana/kit";
import type { MerchantAccount, PaymentHealth, PlanAccount, SubscriptionAccount } from "@recur/sdk";

export type Sub = SubscriptionAccount & { health: PaymentHealth };

// Deterministic PRNG so the demo looks the same on every load
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const addrDec = getAddressDecoder();
const fakeAddr = (rand: () => number): Address =>
  addrDec.decode(Uint8Array.from({ length: 32 }, () => Math.floor(rand() * 256)));

export function demoData(nowSecs = Math.floor(Date.now() / 1000)) {
  const rand = mulberry32(42);
  const now = BigInt(nowSecs);
  const DAY = 86_400n;
  const mint = address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  const merchant: MerchantAccount = {
    address: fakeAddr(rand), authority: fakeAddr(rand), settlementWallet: fakeAddr(rand), planCount: 3n, name: "Alpha Signals",
  };
  const mk = (id: bigint, name: string, amount: number, periodDays: bigint, grace: bigint, count: number): PlanAccount => ({
    address: fakeAddr(rand), merchant: merchant.address, id, mint, amount: BigInt(amount * 1e6),
    periodSecs: periodDays * DAY, graceSecs: grace * DAY, active: true, subscriberCount: BigInt(count), name,
  });
  const plans = [
    mk(0n, "Pro monthly", 19, 30n, 3n, 96),
    mk(1n, "Weekly pass", 5, 7n, 1n, 38),
    mk(2n, "Desk annual", 149, 365n, 7n, 11),
  ];
  const subs: Sub[] = [];
  for (const p of plans) {
    for (let i = 0; i < Number(p.subscriberCount); i++) {
      const cycles = BigInt(1 + Math.floor(rand() * (p.periodSecs === 7n * DAY ? 20 : p.periodSecs === 30n * DAY ? 9 : 2)));
      const roll = rand();
      // most are healthy; a few due soon with problems, a few past due, a couple lapsed
      let next = now + BigInt(Math.floor(rand() * Number(p.periodSecs < 30n * DAY ? p.periodSecs : 30n * DAY)));
      let health: PaymentHealth = "ok";
      if (roll > 0.955) { next = now - BigInt(Math.floor(rand() * Number(p.graceSecs))); health = "balance_low"; }
      else if (roll > 0.93) { next = now - p.graceSecs - DAY * BigInt(1 + Math.floor(rand() * 5)); health = "delegate_missing"; }
      else if (roll > 0.89) health = rand() > 0.5 ? "allowance_low" : "balance_low";
      const created = next - p.periodSecs * cycles;
      subs.push({
        address: fakeAddr(rand), plan: p.address, merchant: merchant.address, subscriber: fakeAddr(rand),
        subscriberTokenAccount: fakeAddr(rand), mint, amount: p.amount, periodSecs: p.periodSecs, graceSecs: p.graceSecs,
        createdAt: created, lastChargedAt: next - p.periodSecs, nextChargeAt: next, cyclesPaid: cycles, maxCycles: 0n,
        budgetRemaining: health === "allowance_low" ? 0n : p.amount * 6n, health,
      });
    }
  }
  return { merchant, plans, subs };
}
