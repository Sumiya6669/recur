import { address } from "@solana/kit";
import {
  buildSubscribeInstructions, compileUnsignedTransaction, fetchMerchant, fetchPlan, fromBaseUnits, noopSigner,
} from "@recur/sdk";
import { serverRpc } from "@/lib/server/rpc";

export const dynamic = "force-dynamic";

const CHAIN_IDS = {
  mainnet: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  devnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
} as const;
const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Action-Version, X-Blockchain-Ids",
  "access-control-expose-headers": "X-Action-Version, X-Blockchain-Ids",
  "content-type": "application/json",
  "x-action-version": "2.4",
  "x-blockchain-ids": process.env.NEXT_PUBLIC_CLUSTER === "mainnet" ? CHAIN_IDS.mainnet : CHAIN_IDS.devnet,
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const origin = (req: Request) => process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;

const PERIOD = (s: bigint) => (s % 2_592_000n === 0n ? "month" : s % 604_800n === 0n ? "week" : s % 86_400n === 0n ? "day" : `${s} seconds`);

async function load(planParam: string) {
  const plan = await fetchPlan(serverRpc(), address(planParam));
  const merchant = plan && (await fetchMerchant(serverRpc(), plan.merchant));
  return plan && merchant ? { plan, merchant } : null;
}

export async function GET(req: Request, ctx: { params: Promise<{ plan: string }> }) {
  try {
    const found = await load((await ctx.params).plan);
    if (!found) return json({ message: "Plan not found" }, 404);
    const { plan, merchant } = found;
    const price = fromBaseUnits(plan.amount);
    return json({
      type: "action",
      icon: `${origin(req)}/blink.png`,
      title: `${merchant.name}: ${plan.name}`,
      description: `${price} USDC every ${PERIOD(plan.periodSecs)}, paid from your own wallet. Cancel anytime.`,
      label: `Subscribe for ${price} USDC`,
      disabled: !plan.active,
      ...(plan.active ? {} : { error: { message: "This plan isn't taking new subscribers." } }),
    });
  } catch {
    return json({ message: "Invalid plan address" }, 400);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ plan: string }> }) {
  try {
    const { account } = (await req.json()) as { account?: string };
    if (!account) return json({ message: "Missing account" }, 400);
    const found = await load((await ctx.params).plan);
    if (!found) return json({ message: "Plan not found" }, 404);
    const subscriber = address(account);
    const { instructions } = await buildSubscribeInstructions({ rpc: serverRpc(), subscriber: noopSigner(subscriber), ...found });
    const { base64 } = await compileUnsignedTransaction(serverRpc(), subscriber, instructions);
    return json({ type: "transaction", transaction: base64, message: `Subscribed to ${found.plan.name}` });
  } catch (e) {
    const m = (e as Error).message;
    const message =
      m === "INSUFFICIENT_BALANCE" ? "Not enough USDC for the first payment." :
      m === "NO_TOKEN_ACCOUNT" ? "This wallet has no USDC yet." :
      m === "ALREADY_SUBSCRIBED" ? "You're already subscribed to this plan." : "Couldn't build the transaction.";
    return json({ message }, 400);
  }
}

export const OPTIONS = () => new Response(null, { headers });
