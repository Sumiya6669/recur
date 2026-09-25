/**
 * Full-stack smoke test against solana-test-validator (program preloaded):
 *   solana-test-validator --reset --bpf-program <PROGRAM_ID> target/deploy/recur.so
 *   node --import tsx scripts/e2e-local.ts
 */
import assert from "node:assert/strict";
import { airdropFactory, createSolanaRpc, createSolanaRpcSubscriptions, generateKeyPairSigner, lamports } from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction,
  getInitializeMint2Instruction, getMintSize, getMintToInstruction,
} from "@solana-program/token";
import {
  buildCancelInstructions, buildCreatePlanInstructions, buildSubscribeInstructions, decodeTokenAccount,
  fetchMaybeAccountBytes, fetchMerchant, fetchPlansByMerchant, fetchSubscriptionsByMerchant,
  fetchSubscriptionsBySubscriber, findMerchantPda, getInitMerchantInstruction, getSubscriptionStatus,
  hasAccess, sendAndConfirm, toBaseUnits,
} from "../packages/sdk/src/index.ts";
import { runKeeperPass, type RecurEvent } from "../packages/sdk/src/keeper.ts";

const rpc = createSolanaRpc("http://127.0.0.1:8899");
const rpcSubs = createSolanaRpcSubscriptions("ws://127.0.0.1:8900");
const airdrop = airdropFactory({ rpc, rpcSubscriptions: rpcSubs });
const now = () => BigInt(Math.floor(Date.now() / 1000));
const step = (m: string) => console.log(`• ${m}`);

const [owner, subscriber, keeper, mintKp] = await Promise.all(Array.from({ length: 4 }, () => generateKeyPairSigner()));
for (const k of [owner, subscriber, keeper]) {
  await airdrop({ recipientAddress: k.address, lamports: lamports(2_000_000_000n), commitment: "confirmed" });
}

step("create test USDC mint and fund subscriber");
const space = BigInt(getMintSize());
const rent = await rpc.getMinimumBalanceForRentExemption(space).send();
await sendAndConfirm(rpc, owner, [
  getCreateAccountInstruction({ payer: owner, newAccount: mintKp, space, lamports: rent, programAddress: TOKEN_PROGRAM_ADDRESS }),
  getInitializeMint2Instruction({ mint: mintKp.address, decimals: 6, mintAuthority: owner.address }),
]);
const mint = mintKp.address;
const [subAta] = await findAssociatedTokenPda({ owner: subscriber.address, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
await sendAndConfirm(rpc, owner, [
  getCreateAssociatedTokenIdempotentInstruction({ payer: owner, ata: subAta, owner: subscriber.address, mint }),
  getMintToInstruction({ mint, token: subAta, mintAuthority: owner, amount: toBaseUnits("25") }),
]);

step("merchant onboarding + two plans (via SDK flows)");
await sendAndConfirm(rpc, owner, [await getInitMerchantInstruction({ authority: owner, settlementWallet: owner.address, name: "E2E Club" })]);
const merchantPda = await findMerchantPda(owner.address);
for (const [name, amount, period] of [["Fast", "1", 60n], ["Monthly", "5", 2_592_000n]] as const) {
  const merchant = (await fetchMerchant(rpc, merchantPda))!;
  await sendAndConfirm(rpc, owner, await buildCreatePlanInstructions({
    rpc, authority: owner, merchant, mint, amount: toBaseUnits(amount), periodSecs: period, graceSecs: 30n, name,
  }));
}
const merchant = (await fetchMerchant(rpc, merchantPda))!;
const plans = await fetchPlansByMerchant(rpc, merchantPda);
assert.deepEqual(plans.map((p) => p.name), ["Fast", "Monthly"]);

step("subscribe to both plans (allowance recomputed for the shared delegate)");
const fast = await buildSubscribeInstructions({ rpc, subscriber, plan: plans[0], merchant });
await sendAndConfirm(rpc, subscriber, fast.instructions);
assert.equal(fast.allowance, toBaseUnits("13"));
const monthly = await buildSubscribeInstructions({ rpc, subscriber, plan: plans[1], merchant, maxCycles: 6n });
await sendAndConfirm(rpc, subscriber, monthly.instructions);
assert.equal(monthly.allowance, toBaseUnits("12") + toBaseUnits("30"), "1*12 remaining + 5*6 new");

const mySubs = await fetchSubscriptionsBySubscriber(rpc, subscriber.address);
assert.equal(mySubs.length, 2);
assert.ok(mySubs.every((s) => hasAccess(s, now())));
assert.equal((await fetchSubscriptionsByMerchant(rpc, merchantPda)).length, 2);

step("keeper: nothing due yet");
const events: RecurEvent[] = [];
let r = await runKeeperPass({ rpc, keeper, sink: (e) => void events.push(e), lookaheadSecs: 0n });
assert.equal(r.due, 0);

step("wait for the 60s period, keeper collects exactly the due one");
await new Promise((res) => setTimeout(res, 65_000));
r = await runKeeperPass({ rpc, keeper, sink: (e) => void events.push(e), lookaheadSecs: 0n });
assert.equal(r.charged.length, 1, JSON.stringify(r));
assert.equal(events.filter((e) => e.type === "payment.succeeded").length, 1);
const ownerAta = (await findAssociatedTokenPda({ owner: owner.address, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];
const merchantBal = decodeTokenAccount((await fetchMaybeAccountBytes(rpc, ownerAta))!.data).amount;
assert.equal(merchantBal, toBaseUnits("7"), "1 + 5 initial + 1 renewal");

step("cancel Fast: approval shrinks to the Monthly budget");
const fastSub = (await fetchSubscriptionsBySubscriber(rpc, subscriber.address)).find((s) => s.plan === plans[0].address)!;
assert.equal(getSubscriptionStatus(fastSub, now()), "active");
await sendAndConfirm(rpc, subscriber, await buildCancelInstructions({ rpc, subscriber, subscription: fastSub }));
const tok = decodeTokenAccount((await fetchMaybeAccountBytes(rpc, subAta))!.data);
assert.equal(tok.delegatedAmount, toBaseUnits("25"), "5 * (6 - 1) remaining monthly payments");
assert.equal((await fetchSubscriptionsBySubscriber(rpc, subscriber.address)).length, 1);

console.log("\n✅ e2e passed");
process.exit(0);
