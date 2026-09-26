import { NextResponse } from "next/server";
import { getStatus } from "@/lib/server/status";
import { en } from "@/lib/i18n/en";

export const dynamic = "force-dynamic";

/** Health for uptime monitors: 200 when everything is fine, 503 with `problems` otherwise. */
export async function GET() {
  try {
    const s = await getStatus();
    return NextResponse.json(
      { ...s, problemCodes: s.problems, problems: s.problems.map((p) => en.statusPage.problems[p]) },
      { status: s.ok ? 200 : 503, headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json({ ok: false, problems: ["The RPC didn't answer."] }, { status: 503 });
  }
}
