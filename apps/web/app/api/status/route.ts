import { NextResponse } from "next/server";
import { getStatus } from "@/lib/server/status";

export const dynamic = "force-dynamic";

/** Health for uptime monitors: 200 when everything is fine, 503 with `problems` otherwise. */
export async function GET() {
  try {
    const s = await getStatus();
    return NextResponse.json(s, {
      status: s.ok ? 200 : 503,
      headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, problems: [`RPC error: ${(e as Error).message}`] }, { status: 503 });
  }
}
