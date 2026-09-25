import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createKeyPairSignerFromBytes, getBase58Encoder } from "@solana/kit";
import { consoleSink, runKeeperPass, webhookSink, type EventSink } from "@recur/sdk/keeper";
import { serverRpc } from "@/lib/server/rpc";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One keeper pass. Call every minute from any scheduler with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const raw = process.env.KEEPER_SECRET_KEY;
  if (!raw) return NextResponse.json({ error: "KEEPER_SECRET_KEY is not set" }, { status: 500 });
  const bytes = raw.trim().startsWith("[") ? Uint8Array.from(JSON.parse(raw)) : new Uint8Array(getBase58Encoder().encode(raw.trim()));
  const keeper = await createKeyPairSignerFromBytes(bytes);

  const sinks: EventSink[] = [consoleSink];
  if (process.env.WEBHOOK_URL && process.env.WEBHOOK_SECRET) sinks.push(webhookSink(process.env.WEBHOOK_URL, process.env.WEBHOOK_SECRET));
  const result = await runKeeperPass({
    rpc: serverRpc(), keeper, maxCharges: 25,
    sink: async (e) => { for (const s of sinks) await s(e); },
  });
  return NextResponse.json(result);
}
