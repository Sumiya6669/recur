import { NextResponse } from "next/server";
import { address } from "@solana/kit";
import { fetchSubscription, findSubscriptionPda, getSubscriptionStatus, hasAccess } from "@recur/sdk";
import { serverRpc } from "@/lib/server/rpc";

export const dynamic = "force-dynamic";
const cors = { "access-control-allow-origin": "*", "cache-control": "public, s-maxage=15, stale-while-revalidate=30" };

export async function GET(req: Request) {
  const url = new URL(req.url);
  let plan, wallet;
  try {
    plan = address(url.searchParams.get("plan") ?? "");
    wallet = address(url.searchParams.get("wallet") ?? "");
  } catch {
    return NextResponse.json({ error: "Pass valid `plan` and `wallet` addresses." }, { status: 400, headers: cors });
  }
  const sub = await fetchSubscription(serverRpc(), await findSubscriptionPda(plan, wallet));
  if (!sub) return NextResponse.json({ active: false, status: "none" }, { headers: cors });
  const now = BigInt(Math.floor(Date.now() / 1000));
  return NextResponse.json(
    {
      active: hasAccess(sub, now),
      status: getSubscriptionStatus(sub, now),
      next_charge_at: Number(sub.nextChargeAt),
      payments: Number(sub.cyclesPaid),
      subscription: sub.address,
    },
    { headers: cors },
  );
}

export function OPTIONS() {
  return new Response(null, { headers: { ...cors, "access-control-allow-methods": "GET, OPTIONS" } });
}
