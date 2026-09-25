/**
 * Creates a merchant and demo plans, prints checkout links.
 *
 *   RPC_URL=https://api.devnet.solana.com \
 *   APP_URL=https://your-app.vercel.app \
 *   npm run seed:devnet
 *
 * Env: RPC_URL, [PAYER_KEYPAIR=~/.config/solana/id.json], [MINT=devnet USDC],
 *      [MERCHANT_NAME], [APP_URL=http://localhost:3000], [RECUR_PROGRAM_ID]
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { address, createKeyPairSignerFromBytes, createSolanaRpc } from "@solana/kit";
import {
  USDC_MINT, buildCreatePlanInstructions, fetchMerchant, fetchPlansByMerchant, findMerchantPda,
  getInitMerchantInstruction, sendAndConfirm, toBaseUnits,
} from "../packages/sdk/src/index.ts";

const rpcUrl = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const rpc = createSolanaRpc(rpcUrl);
const keyPath = (process.env.PAYER_KEYPAIR ?? "~/.config/solana/id.json").replace("~", homedir());
const payer = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(readFileSync(keyPath, "utf8"))));
const mint = address(process.env.MINT ?? USDC_MINT.devnet);
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const PLANS = [
  { name: "Pro monthly", amount: "10", periodSecs: 30n * 86_400n, graceSecs: 3n * 86_400n },
  { name: "Weekly pass", amount: "3", periodSecs: 7n * 86_400n, graceSecs: 86_400n },
  { name: "Live demo, every 2 minutes", amount: "0.1", periodSecs: 120n, graceSecs: 60n },
];

const merchantPda = await findMerchantPda(payer.address);
let merchant = await fetchMerchant(rpc, merchantPda);
if (!merchant) {
  console.log("Creating merchant…");
  await sendAndConfirm(rpc, payer, [
    await getInitMerchantInstruction({
      authority: payer,
      settlementWallet: payer.address,
      name: process.env.MERCHANT_NAME ?? "Recur Demo Club",
    }),
  ]);
  merchant = (await fetchMerchant(rpc, merchantPda))!;
}
console.log(`Merchant  ${merchant.name}  ${merchant.address}`);

const existing = await fetchPlansByMerchant(rpc, merchant.address);
for (const p of PLANS) {
  if (existing.some((e) => e.name === p.name)) continue;
  merchant = (await fetchMerchant(rpc, merchantPda))!;
  console.log(`Creating plan "${p.name}"…`);
  await sendAndConfirm(
    rpc,
    payer,
    await buildCreatePlanInstructions({
      rpc, authority: payer, merchant, mint,
      amount: toBaseUnits(p.amount), periodSecs: p.periodSecs, graceSecs: p.graceSecs, name: p.name,
    }),
  );
}

for (const p of await fetchPlansByMerchant(rpc, merchant.address)) {
  console.log(`  ${p.name.padEnd(26)} ${appUrl}/pay/${p.address}`);
}
console.log(`\nDashboard: ${appUrl}/dashboard (connect ${payer.address})`);
