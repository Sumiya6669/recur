/**
 * End-to-end check against the deployed site and the devnet program:
 * Blink builds a transaction, subscribe, /api/access says active, the production keeper
 * (/api/cron/charge, or cron-job.org if it is already running) collects the next payment,
 * cancel shrinks the approval and /api/access flips to inactive.
 *
 *   RPC_URL=<helius devnet> APP_URL=https://recur-tawny.vercel.app CRON_SECRET=... \
 *   SUBSCRIBER_KEYPAIR=~/.recur-keys/tester.json PLAN=<plan with a short period> \
 *   node --import tsx scripts/e2e-devnet.ts
 *
 * The subscriber needs devnet USDC (faucet.circle.com) and a little SOL for fees.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { address, createKeyPairSignerFromBytes, createSolanaRpc } from "@solana/kit";
import {
  buildCancelInstructions, buildSubscribeInstructions, decodeTokenAccount, fetchMaybeAccountBytes, fetchMerchant,
  fetchPlan, fetchSubscriptionsBySubscriber, sendAndConfirm,
} from "../packages/sdk/src/index.ts";

const env = (k: string) => process.env[k] ?? (() => { throw new Error(`${k} is not set`); })();
const rpc = createSolanaRpc(env("RPC_URL"));
const app = env("APP_URL").replace(/\/$/, "");
const keyPath = env("SUBSCRIBER_KEYPAIR").replace("~", homedir());
const subscriber = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(readFileSync(keyPath, "utf8"))));
const plan = (await fetchPlan(rpc, address(env("PLAN"))))!;
assert.ok(plan, "plan not found on chain");
const merchant = (await fetchMerchant(rpc, plan.merchant))!;
const now = () => BigInt(Math.floor(Date.now() / 1000));
const step = (m: string) => console.log(`• ${m}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const access = async () =>
  (await (await fetch(`${app}/api/access?plan=${plan.address}&wallet=${subscriber.address}`, { cache: "no-store" })).json()) as { active: boolean; status: string };
const mine = async () => (await fetchSubscriptionsBySubscriber(rpc, subscriber.address)).find((s) => s.plan === plan.address);

console.log(`Subscriber ${subscriber.address}\nPlan       ${plan.name} (${plan.address}), every ${plan.periodSecs}s\n`);

const leftover = await mine();
if (leftover) {
  step("cleaning up a subscription left by an earlier run");
  await sendAndConfirm(rpc, subscriber, await buildCancelInstructions({ rpc, subscriber, subscription: leftover }));
}

step("Blink: GET metadata and POST builds a transaction");
const meta = await (await fetch(`${app}/api/actions/subscribe/${plan.address}`)).json();
assert.equal(meta.disabled, false, JSON.stringify(meta));
const post = await fetch(`${app}/api/actions/subscribe/${plan.address}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: subscriber.address }),
});
const action = await post.json();
assert.equal(post.status, 200, JSON.stringify(action));
assert.ok(typeof action.transaction === "string" && action.transaction.length > 100, "no transaction in Blink response");

step("subscribe (approve + first payment in one transaction)");
const { instructions, allowance, subscriberAta, merchantAta } = await buildSubscribeInstructions({
  rpc, subscriber, plan, merchant, maxCycles: 5n,
});
const merchantBefore = decodeTokenAccount((await fetchMaybeAccountBytes(rpc, merchantAta))?.data ?? new Uint8Array(165)).amount;
console.log(`  signature ${await sendAndConfirm(rpc, subscriber, instructions)}`);
const sub = (await mine())!;
assert.equal(sub.cyclesPaid, 1n);
// The first payment is taken from the approval in the same transaction.
assert.equal(decodeTokenAccount((await fetchMaybeAccountBytes(rpc, subscriberAta))!.data).delegatedAmount, allowance - plan.amount);

step("/api/access reports the wallet as active");
assert.equal((await access()).active, true);

const waitSecs = Number(sub.nextChargeAt - now()) + 5;
step(`waiting ${waitSecs}s for the next payment to fall due`);
await sleep(Math.max(0, waitSecs) * 1000);

step("production keeper collects it");
let charged = false;
for (let i = 0; i < 12 && !charged; i++) {
  if ((await mine())!.cyclesPaid >= 2n) { charged = true; break; }
  if (i === 2) {
    const r = await fetch(`${app}/api/cron/charge`, { headers: { authorization: `Bearer ${env("CRON_SECRET")}` } });
    console.log(`  /api/cron/charge ${r.status} ${await r.text()}`);
  }
  await sleep(10_000);
}
assert.ok(charged, "second payment was not collected");
const merchantAfter = decodeTokenAccount((await fetchMaybeAccountBytes(rpc, merchantAta))!.data).amount;
assert.equal(merchantAfter - merchantBefore, 2n * plan.amount, "merchant received the first and the renewal payment");

step("cancel: subscription closed, approval shrinks to what other subscriptions need");
await sendAndConfirm(rpc, subscriber, await buildCancelInstructions({ rpc, subscriber, subscription: (await mine())! }));
assert.equal(await mine(), undefined);
const others = (await fetchSubscriptionsBySubscriber(rpc, subscriber.address)).filter((s) => s.subscriberTokenAccount === subscriberAta);
const tok = decodeTokenAccount((await fetchMaybeAccountBytes(rpc, subscriberAta))!.data);
if (others.length === 0) assert.equal(tok.delegatedAmount, 0n);

step("/api/access reports the wallet as inactive (edge cache up to 45s)");
let inactive = false;
for (let i = 0; i < 8 && !inactive; i++) { inactive = !(await access()).active; if (!inactive) await sleep(10_000); }
assert.ok(inactive, "access still active after cancel");

console.log("\n✅ devnet e2e passed");
process.exit(0);
