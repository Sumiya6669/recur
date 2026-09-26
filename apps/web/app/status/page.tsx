import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { explorerAddr } from "@/lib/config";
import { relative, short } from "@/lib/format";
import { getStatus, type Status } from "@/lib/server/status";

export const metadata: Metadata = { title: "Status" };
export const revalidate = 30;

const sol = (lamports: string) => `${(Number(lamports) / 1e9).toFixed(3)} SOL`;

function Row({ label, children, tone }: { label: string; children: React.ReactNode; tone?: "ok" | "warn" | "bad" }) {
  const dot = tone === "bad" ? "bg-coral" : tone === "warn" ? "bg-amber" : tone === "ok" ? "bg-usdc" : null;
  return (
    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="text-mute">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2.5 sm:justify-end">
        {dot && <span className={`size-2 shrink-0 rounded-full ${dot}`} />}
        <span className="min-w-0 break-words">{children}</span>
      </dd>
    </div>
  );
}

export default async function StatusPage() {
  let s: Status | null = null;
  let error: string | null = null;
  try { s = await getStatus(); } catch (e) { error = (e as Error).message; }
  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-8" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        <Link href="/"><Logo /></Link>
        <Link href="/dashboard" className="rounded-full border border-line px-4 py-2 text-[14px] hover:border-mute">Dashboard</Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:px-8">
        <h1 className="display text-[clamp(34px,5vw,52px)] font-semibold">
          {s?.ok ? "Everything is running" : "Something needs attention"}
        </h1>
        <p className="mt-2 text-[15px] text-mute">
          Live from the chain{s ? `, checked ${relative(s.checkedAt, now)}` : ""}. Refreshes every 30 seconds. JSON at{" "}
          <a href="/api/status" className="underline underline-offset-4 hover:text-fg">/api/status</a>.
        </p>

        {error && <p className="mt-8 rounded-2xl border border-coral/40 bg-coral/5 p-4 text-[14px] text-coral">Couldn't reach the RPC: {error}</p>}
        {s && s.problems.length > 0 && (
          <ul className="mt-8 space-y-2 rounded-2xl border border-amber/30 bg-amber/5 p-4 text-[14px] text-amber">
            {s.problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}

        {s && (
          <>
            <h2 className="display mt-12 text-[24px] font-semibold">Payments</h2>
            <dl className="mt-3 divide-y divide-line border-y border-line text-[15px]">
              <Row label="Active subscriptions" tone="ok">{s.subscriptions.active}</Row>
              <Row label="Due, inside the grace period" tone={s.subscriptions.pastDue ? "warn" : undefined}>
                {s.subscriptions.pastDue}
                {s.subscriptions.oldestDueAt && <span className="text-dim">, oldest {relative(s.subscriptions.oldestDueAt, now)}</span>}
              </Row>
              <Row label="Lapsed">{s.subscriptions.lapsed}</Row>
              <Row label="Completed">{s.subscriptions.completed}</Row>
            </dl>

            <h2 className="display mt-12 text-[24px] font-semibold">Keeper</h2>
            <dl className="mt-3 divide-y divide-line border-y border-line text-[15px]">
              <Row label="Wallet" tone={s.keeper.address ? "ok" : "bad"}>
                {s.keeper.address
                  ? <a href={explorerAddr(s.keeper.address)} className="font-mono text-[13px] hover:text-fg">{short(s.keeper.address, 6)}</a>
                  : "Not configured"}
              </Row>
              {s.keeper.lamports !== null && (
                <Row label="Balance for fees" tone={s.keeper.low ? "warn" : "ok"}>{sol(s.keeper.lamports)}</Row>
              )}
              <Row label="Last transaction">{s.keeper.lastActivityAt ? relative(s.keeper.lastActivityAt, now) : "None yet"}</Row>
            </dl>

            <h2 className="display mt-12 text-[24px] font-semibold">Program</h2>
            <dl className="mt-3 divide-y divide-line border-y border-line text-[15px]">
              <Row label="Network">{s.cluster}</Row>
              <Row label="Program" tone={s.program.deployed ? "ok" : "bad"}>
                <a href={explorerAddr(s.program.address)} className="font-mono text-[13px] hover:text-fg">{short(s.program.address, 6)}</a>
              </Row>
            </dl>
          </>
        )}
      </main>
      <SiteFooter className="max-w-3xl" />
    </div>
  );
}
