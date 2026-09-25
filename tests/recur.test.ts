import { test, before } from "node:test";
import assert from "node:assert/strict";
import { LiteSVM, FailedTransactionMetadata } from "litesvm";
import {
  appendTransactionMessageInstructions, createTransactionMessage, generateKeyPairSigner, lamports,
  pipe, setTransactionMessageFeePayerSigner, signTransactionMessageWithSigners,
  type Address, type Instruction, type KeyPairSigner,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda, getApproveInstruction,
  getCreateAssociatedTokenIdempotentInstruction, getInitializeMint2Instruction, getMintSize,
  getMintToInstruction, getRevokeInstruction, getTokenDecoder, getTransferInstruction,
} from "@solana-program/token";
import {
  RECUR_PROGRAM_ID, decodeMerchant, decodePlan, decodeSubscription, findDelegatePda, findMerchantPda,
  findPlanPda, findSubscriptionPda, getCancelInstruction as cancelIx, getChargeInstruction as chargeIx,
  getCreatePlanInstruction as createPlanIx, getInitMerchantInstruction, getSetPlanActiveInstruction,
  getSubscribeInstruction as subscribeIx, getSubscriptionStatus, hasAccess, requiredAllowance,
} from "../packages/sdk/src/index.ts";

const isActive = (s: ReturnType<typeof decodeSubscription>, t: bigint) => hasAccess(s, t);
const initMerchantIx = (a: KeyPairSigner, w: Address) => getInitMerchantInstruction({ authority: a, settlementWallet: w, name: "Alpha Signals ⚡" });
const setPlanActiveIx = (a: KeyPairSigner, plan: Address, active: boolean) => getSetPlanActiveInstruction({ authority: a, plan, active });

const USDC = (n: number) => BigInt(Math.round(n * 1_000_000));
const DAY = 86_400n;

let svm: LiteSVM;
let payer: KeyPairSigner, mintAuth: KeyPairSigner, merchantAuth: KeyPairSigner, treasury: KeyPairSigner;
let alice: KeyPairSigner, mallory: KeyPairSigner;
let mint: Address, delegate: Address, merchant: Address, plan0: Address, plan1: Address;
let aliceAta: Address, treasuryAta: Address, malloryAta: Address;

// ------------------------------------------------------------------ helpers

async function send(signer: KeyPairSigner, ixs: Instruction[]) {
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => svm.setTransactionMessageLifetimeUsingLatestBlockhash(m),
    (m) => appendTransactionMessageInstructions(ixs, m),
  );
  const tx = await signTransactionMessageWithSigners(msg);
  const res = svm.sendTransaction(tx);
  svm.expireBlockhash();
  return res;
}
async function ok(signer: KeyPairSigner, ixs: Instruction[]) {
  const res = await send(signer, ixs);
  if (res instanceof FailedTransactionMetadata) {
    assert.fail(`tx failed: ${res.toString()}\n${res.meta().logs().join("\n")}`);
  }
  return res;
}
async function fails(signer: KeyPairSigner, ixs: Instruction[], expected: string) {
  const res = await send(signer, ixs);
  assert.ok(res instanceof FailedTransactionMetadata, `expected failure "${expected}", tx succeeded`);
  const logs = res.meta().logs().join("\n");
  assert.ok(logs.includes(expected), `expected "${expected}" in logs:\n${logs}`);
}
const balance = (ata: Address) => {
  const acc = svm.getAccount(ata);
  return acc.exists ? getTokenDecoder().decode(acc.data).amount : 0n;
};
const sub = async (plan: Address, who: Address) => {
  const addr = await findSubscriptionPda(plan, who);
  const acc = svm.getAccount(addr);
  return acc.exists ? decodeSubscription(addr, acc.data) : null;
};
const now = () => svm.getClock().unixTimestamp;
const warp = (secs: bigint) => { const c = svm.getClock(); c.unixTimestamp += secs; c.slot += 1n; svm.setClock(c); };
const ata = async (owner: Address) =>
  (await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];

const subscribeWithApproval = async (who: KeyPairSigner, plan: Address, whoAta: Address, allowance: bigint, maxCycles = 0n) => [
  getApproveInstruction({ source: whoAta, delegate, owner: who, amount: allowance }),
  await subscribeIx({
    subscriber: who, merchant, plan, mint, subscriberTokenAccount: whoAta,
    merchantTokenAccount: treasuryAta, tokenProgram: TOKEN_PROGRAM_ADDRESS, maxCycles,
  }),
];
const charge = async (who: Address, plan: Address, whoAta: Address, to: Address = treasuryAta) =>
  chargeIx({
    cranker: payer, merchant, subscription: await findSubscriptionPda(plan, who), mint,
    subscriberTokenAccount: whoAta, merchantTokenAccount: to, tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });

// ------------------------------------------------------------------ setup

before(async () => {
  svm = new LiteSVM();
  svm.addProgramFromFile(RECUR_PROGRAM_ID, "target/deploy/recur.so");

  [payer, mintAuth, merchantAuth, treasury, alice, mallory] = await Promise.all(
    Array.from({ length: 6 }, () => generateKeyPairSigner()),
  );
  for (const k of [payer, merchantAuth, alice, mallory]) svm.airdrop(k.address, lamports(10_000_000_000n));

  // A 6-decimals "USDC" mint
  const mintKp = await generateKeyPairSigner();
  mint = mintKp.address;
  const space = BigInt(getMintSize());
  await ok(payer, [
    getCreateAccountInstruction({
      payer, newAccount: mintKp, space, programAddress: TOKEN_PROGRAM_ADDRESS,
      lamports: lamports(svm.minimumBalanceForRentExemption(space)),
    }),
    getInitializeMint2Instruction({ mint, decimals: 6, mintAuthority: mintAuth.address }),
  ]);

  aliceAta = await ata(alice.address);
  treasuryAta = await ata(treasury.address);
  malloryAta = await ata(mallory.address);
  const mk = (owner: Address, a: Address) =>
    getCreateAssociatedTokenIdempotentInstruction({ payer, ata: a, owner, mint });
  await ok(payer, [
    mk(alice.address, aliceAta), mk(treasury.address, treasuryAta), mk(mallory.address, malloryAta),
    getMintToInstruction({ mint, token: aliceAta, mintAuthority: mintAuth, amount: USDC(100) }),
  ]);

  delegate = await findDelegatePda();
  merchant = await findMerchantPda(merchantAuth.address);
  plan0 = await findPlanPda(merchant, 0n);
  plan1 = await findPlanPda(merchant, 1n);
});

// ------------------------------------------------------------------ tests

test("merchant registers and creates plans", async () => {
  await ok(merchantAuth, [await initMerchantIx(merchantAuth, treasury.address)]);
  await ok(merchantAuth, [
    await createPlanIx({ authority: merchantAuth, planId: 0n, mint, amount: USDC(10), periodSecs: 30n * DAY, graceSecs: 3n * DAY, name: "Pro monthly" }),
    await createPlanIx({ authority: merchantAuth, planId: 1n, mint, amount: USDC(5), periodSecs: 7n * DAY, graceSecs: 1n * DAY, name: "Weekly pass" }),
  ]);
  await fails(merchantAuth, [
    await createPlanIx({ authority: merchantAuth, planId: 2n, mint, amount: USDC(1), periodSecs: 10n, graceSecs: 0n, name: "x" }),
  ], "InvalidPeriod");
  // a Token-2022 mint is rejected
  const t22 = await generateKeyPairSigner();
  const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" as Address;
  await ok(payer, [
    getCreateAccountInstruction({ payer, newAccount: t22, space: 82n, programAddress: T22, lamports: lamports(svm.minimumBalanceForRentExemption(82n)) }),
    getInitializeMint2Instruction({ mint: t22.address, decimals: 6, mintAuthority: mintAuth.address }, { programAddress: T22 }),
  ]);
  await fails(merchantAuth, [
    await createPlanIx({ authority: merchantAuth, planId: 2n, mint: t22.address, amount: USDC(1), periodSecs: 3600n, graceSecs: 0n, name: "t22" }),
  ], "UnsupportedMint");
  const m = decodeMerchant(merchant, (svm.getAccount(merchant) as any).data);
  assert.equal(m.name, "Alpha Signals ⚡");
  assert.equal(m.planCount, 2n);
  const p = decodePlan(plan0, (svm.getAccount(plan0) as any).data);
  assert.equal(p.name, "Pro monthly");
  assert.equal(p.amount, USDC(10));
});

test("subscribe = approve + first payment in one transaction", async () => {
  await ok(alice, await subscribeWithApproval(alice, plan0, aliceAta, USDC(120)));
  assert.equal(balance(treasuryAta), USDC(10));
  assert.equal(balance(aliceAta), USDC(90));
  const s = (await sub(plan0, alice.address))!;
  assert.equal(s.cyclesPaid, 1n);
  assert.equal(s.nextChargeAt, s.createdAt + 30n * DAY);
  assert.ok(isActive(s, now()));
});

test("charge before due date is rejected", async () => {
  await fails(payer, [await charge(alice.address, plan0, aliceAta)], "NotDue");
});

test("anyone can crank a due payment; schedule is preserved", async () => {
  const s0 = (await sub(plan0, alice.address))!;
  warp(30n * DAY + 3600n); // keeper is 1h late
  await ok(payer, [await charge(alice.address, plan0, aliceAta)]);
  const s1 = (await sub(plan0, alice.address))!;
  assert.equal(balance(treasuryAta), USDC(20));
  assert.equal(s1.cyclesPaid, 2n);
  assert.equal(s1.nextChargeAt, s0.nextChargeAt + 30n * DAY, "no drift from late keeper");
});

test("cannot redirect a payment to a different token account", async () => {
  warp(30n * DAY);
  await fails(payer, [await charge(alice.address, plan0, aliceAta, malloryAta)], "ConstraintTokenOwner");
});

test("one wallet can hold several subscriptions (shared delegate)", async () => {
  // top up allowance: remaining allowance + new plan budget
  const acc = svm.getAccount(aliceAta);
  assert.ok(acc.exists);
  const remaining = getTokenDecoder().decode(acc.data).delegatedAmount;
  await ok(alice, await subscribeWithApproval(alice, plan1, aliceAta, remaining + USDC(20)));
  await ok(payer, [await charge(alice.address, plan0, aliceAta)]); // plan0 due from previous warp
  assert.equal((await sub(plan1, alice.address))!.cyclesPaid, 1n);
  assert.equal((await sub(plan0, alice.address))!.cyclesPaid, 3n);
});

test("empty wallet -> charge fails, subscription lapses after grace, then restarts without back-billing", async () => {
  // Alice moves all funds away
  await ok(alice, [getTransferInstruction({ source: aliceAta, destination: malloryAta, authority: alice, amount: balance(aliceAta) })]);
  warp(31n * DAY);
  await fails(payer, [await charge(alice.address, plan0, aliceAta)], "InsufficientFunds");
  warp(5n * DAY); // beyond 3-day grace
  const lapsed = (await sub(plan0, alice.address))!;
  assert.equal(isActive(lapsed, now()), false);

  // Funds come back -> one charge, new period starts from now
  await ok(payer, [getMintToInstruction({ mint, token: aliceAta, mintAuthority: mintAuth, amount: USDC(50) })]);
  const before = balance(treasuryAta);
  await ok(payer, [await charge(alice.address, plan0, aliceAta)]);
  const s = (await sub(plan0, alice.address))!;
  assert.equal(balance(treasuryAta) - before, USDC(10), "charged exactly one period");
  assert.equal(s.nextChargeAt, now() + 30n * DAY);
  assert.ok(isActive(s, now()));
});

test("revoking approval stops charges", async () => {
  await ok(alice, [getRevokeInstruction({ source: aliceAta, owner: alice })]);
  warp(31n * DAY);
  await fails(payer, [await charge(alice.address, plan0, aliceAta)], "DelegateNotApproved");
});

test("paused plan rejects new subscribers", async () => {
  await ok(merchantAuth, [await setPlanActiveIx(merchantAuth, plan1, false)]);
  await ok(payer, [getMintToInstruction({ mint, token: malloryAta, mintAuthority: mintAuth, amount: USDC(10) })]);
  await fails(mallory, await subscribeWithApproval(mallory, plan1, malloryAta, USDC(10)), "PlanInactive");
});

test("only subscriber or merchant can cancel; rent refunded; no charges after", async () => {
  const subPda = await findSubscriptionPda(plan0, alice.address);
  const args = { merchant, plan: plan0, subscription: subPda, subscriber: alice.address };
  await fails(mallory, [cancelIx({ signer: mallory, ...args })], "Unauthorized");

  const lamportsBefore = svm.getBalance(alice.address)!;
  await ok(payer, [cancelIx({ signer: alice, ...args })]); // payer pays the fee, alice signs
  assert.equal(svm.getAccount(subPda).exists, false);
  assert.ok(svm.getBalance(alice.address)! > lamportsBefore, "rent refunded to subscriber");
  await fails(payer, [await charge(alice.address, plan0, aliceAta)], "AccountNotInitialized");

  // merchant can cancel too
  const sub1 = await findSubscriptionPda(plan1, alice.address);
  await ok(merchantAuth, [cancelIx({ signer: merchantAuth, merchant, plan: plan1, subscription: sub1, subscriber: alice.address })]);
  assert.equal(svm.getAccount(sub1).exists, false);
});

test("max_cycles: subscription completes after N payments, access lasts until the period ends", async () => {
  const bob = await generateKeyPairSigner();
  svm.airdrop(bob.address, lamports(1_000_000_000n));
  const bobAta = await ata(bob.address);
  await ok(payer, [
    getCreateAssociatedTokenIdempotentInstruction({ payer, ata: bobAta, owner: bob.address, mint }),
    getMintToInstruction({ mint, token: bobAta, mintAuthority: mintAuth, amount: USDC(100) }),
  ]);
  await ok(merchantAuth, [await setPlanActiveIx(merchantAuth, plan1, true)]);
  await ok(bob, await subscribeWithApproval(bob, plan1, bobAta, USDC(15), 3n));
  for (let i = 0; i < 2; i++) { warp(7n * DAY); await ok(payer, [await charge(bob.address, plan1, bobAta)]); }
  const s = (await sub(plan1, bob.address))!;
  assert.equal(s.cyclesPaid, 3n);
  assert.equal(getSubscriptionStatus(s, now()), "completed");
  warp(7n * DAY);
  await fails(payer, [await charge(bob.address, plan1, bobAta)], "SubscriptionCompleted");
  assert.equal(getSubscriptionStatus(s, now()), "lapsed");
});

test("requiredAllowance sums every subscription on the token account", async () => {
  const base = { mint, merchant, subscriber: alice.address, periodSecs: DAY, graceSecs: 0n, createdAt: 0n, lastChargedAt: 0n, nextChargeAt: 0n } as const;
  const subs = [
    { ...base, address: plan0, plan: plan0, subscriberTokenAccount: aliceAta, amount: USDC(10), cyclesPaid: 1n, maxCycles: 0n },
    { ...base, address: plan1, plan: plan1, subscriberTokenAccount: aliceAta, amount: USDC(5), cyclesPaid: 2n, maxCycles: 4n },
    { ...base, address: merchant, plan: plan1, subscriberTokenAccount: malloryAta, amount: USDC(99), cyclesPaid: 1n, maxCycles: 0n },
  ];
  // 10*12 (unlimited -> 12 future) + 5*2 (4-2 remaining)
  assert.equal(requiredAllowance(subs, aliceAta), USDC(130));
  assert.equal(requiredAllowance(subs, aliceAta, { exclude: plan0 }), USDC(10));
  // new plan with no cap: first payment + 12 future
  assert.equal(requiredAllowance([], aliceAta, { add: { amount: USDC(2), maxCycles: 0n } }), USDC(26));
});
