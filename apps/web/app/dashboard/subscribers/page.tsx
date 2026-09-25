"use client";
import { useMemo, useState } from "react";
import { address } from "@solana/kit";
import { useWallet } from "@solana/wallet-adapter-react";
import { getCancelInstruction, noopSigner } from "@recur/sdk";
import { useDashboard } from "@/components/dashboard/context";
import { HEALTH_LABEL, StatusPill } from "@/components/StatusPill";
import { dateTime, period, relative, short, usdc } from "@/lib/format";
import { explorerAddr, explorerTx } from "@/lib/config";
import { signAndSend } from "@/lib/send";
import { explain } from "@/lib/errors";
import { useUI } from "@/app/providers";
import type { Row } from "@/lib/metrics";

const FILTERS = [
  { id: "all", label: "All", test: (_: Row) => true },
  { id: "active", label: "Active", test: (r: Row) => r.status === "active" },
  { id: "attention", label: "Needs attention", test: (r: Row) => r.atRisk },
  { id: "past_due", label: "Past due", test: (r: Row) => r.status === "past_due" },
  { id: "lapsed", label: "Lapsed", test: (r: Row) => r.status === "lapsed" },
] as const;

export default function Subscribers() {
  const { ready, demo, reload } = useDashboard();
  const wallet = useWallet();
  const { toast } = useUI();
  const r = ready!;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [plan, setPlan] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const nowN = Number(r.now);

  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!;
    return r.metrics.rows
      .filter((x) => f.test(x) && (plan === "all" || x.plan === plan) && (!q || x.subscriber.toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => Number(a.nextChargeAt - b.nextChargeAt));
  }, [r.metrics.rows, filter, plan, q]);

  function exportCsv() {
    const head = ["subscriber", "plan", "amount_usdc", "period_secs", "status", "next_charge_at", "payments", "health", "subscription"];
    const lines = rows.map((x) => [x.subscriber, x.planName, Number(x.amount) / 1e6, x.periodSecs, x.status,
      new Date(Number(x.nextChargeAt) * 1000).toISOString(), x.cyclesPaid, x.health, x.address].join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `recur-subscribers-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function cancel(x: Row) {
    if (demo) return toast({ tone: "info", title: "Sample data", body: "Connect your wallet to manage real subscribers." });
    if (!confirm(`Cancel ${short(x.subscriber)}'s ${x.planName} subscription? They won't be charged again.`)) return;
    setBusy(x.address);
    try {
      const sig = await signAndSend(wallet, [getCancelInstruction({
        signer: noopSigner(address(wallet.publicKey!.toBase58())),
        merchant: r.merchant.address, plan: x.plan, subscription: x.address, subscriber: x.subscriber,
      })]);
      toast({ tone: "ok", title: "Subscription cancelled", href: explorerTx(sig) });
      await reload();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't cancel", body: explain(e) });
    } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[clamp(30px,4vw,44px)] font-semibold">Subscribers</h1>
          <p className="mt-1 text-[15px] text-mute">{r.metrics.active} with access, {r.metrics.rows.length} in total</p>
        </div>
        <button onClick={exportCsv} className="rounded-full border border-line px-4 py-2 text-[14px] hover:border-mute">Export CSV</button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const n = r.metrics.rows.filter(f.test).length;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
              className={`rounded-full px-3.5 py-1.5 text-[13px] transition ${filter === f.id ? "bg-fg text-ink" : "border border-line text-mute hover:text-fg"}`}>
              {f.label} <span className="tabular opacity-60">{n}</span>
            </button>
          );
        })}
        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <select value={plan} onChange={(e) => setPlan(e.target.value)}
            className="rounded-xl border border-line bg-deep px-3 py-2 text-[13px] outline-none focus:border-usdc">
            <option value="all">All plans</option>
            {r.plans.map((p) => <option key={p.address} value={p.address}>{p.name}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search wallet"
            className="min-w-0 flex-1 rounded-xl border border-line bg-deep px-3 py-2 text-[13px] outline-none placeholder:text-dim focus:border-usdc sm:w-56" />
        </div>
      </div>

      <div className="scroll-x mt-5 rounded-2xl border border-line">
        <table className="w-full min-w-[860px] text-left text-[14px]">
          <thead className="bg-deep/70 text-[13px] text-mute">
            <tr>
              <th className="px-4 py-3 font-medium">Subscriber</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Next payment</th>
              <th className="px-4 py-3 text-right font-medium">Paid</th>
              <th className="px-4 py-3 font-medium">Wallet</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.slice(0, 300).map((x) => (
              <tr key={x.address} className="hover:bg-deep/50">
                <td className="px-4 py-3">
                  <a href={explorerAddr(x.subscriber)} target="_blank" rel="noreferrer" className="font-mono text-[13px] hover:text-usdc-soft">{short(x.subscriber, 5)}</a>
                </td>
                <td className="px-4 py-3">
                  <div>{x.planName}</div>
                  <div className="text-[12px] text-dim">{usdc(x.amount)} USDC {period(x.periodSecs).adverb}</div>
                </td>
                <td className="px-4 py-3"><StatusPill status={x.status} /></td>
                <td className="px-4 py-3">
                  <div title={dateTime(x.nextChargeAt)}>{x.status === "completed" ? "No more payments" : relative(x.nextChargeAt, nowN)}</div>
                  <div className="text-[12px] text-dim">{dateTime(x.nextChargeAt)}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="tabular">{usdc(x.amount * x.cyclesPaid)}</div>
                  <div className="text-[12px] text-dim">{x.cyclesPaid.toString()} payment{x.cyclesPaid === 1n ? "" : "s"}</div>
                </td>
                <td className={`px-4 py-3 text-[13px] ${x.health === "ok" ? "text-mute" : "text-amber"}`}>{HEALTH_LABEL[x.health]}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => cancel(x)} disabled={busy === x.address}
                    className="rounded-full px-3 py-1 text-[13px] text-dim hover:bg-raise hover:text-coral disabled:opacity-50">
                    {busy === x.address ? "Cancelling…" : "Cancel"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-[14px] text-mute">No subscribers match these filters.</p>}
      </div>
      {rows.length > 300 && <p className="mt-3 text-[13px] text-dim">Showing the first 300. Export CSV for the full list.</p>}
    </div>
  );
}
