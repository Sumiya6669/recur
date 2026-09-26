"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { address } from "@solana/kit";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  buildCancelInstructions, buildRestoreInstructions, decodeMerchant, decodePlan, decodeTokenAccount,
  fetchMultipleAccountBytes, fetchSubscriptionsBySubscriber, getPaymentHealth, getSubscriptionStatus, noopSigner,
  type PaymentHealth, type SubscriptionAccount,
} from "@recur/sdk";
import { Logo } from "@/components/Logo";
import { WalletButton } from "@/components/WalletButton";
import { StatusPill } from "@/components/StatusPill";
import { useUI } from "@/app/providers";
import { explorerTx, rpc } from "@/lib/config";
import { dateTime, nowSecs, period, relative, usdc } from "@/lib/format";
import { signAndSend } from "@/lib/send";
import { explain } from "@/lib/errors";
import { useT } from "@/lib/i18n/client";
import { LangSwitch } from "@/components/LangSwitch";

type Item = SubscriptionAccount & { planName: string; merchantName: string; health: PaymentHealth };

function Ring({ progress, tone }: { progress: number; tone: string }) {
  const r = 18, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="size-11 shrink-0 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-line)" strokeWidth="3" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={tone} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.02, Math.min(1, progress)))} />
    </svg>
  );
}

export default function Account() {
  const wallet = useWallet();
  const { openConnect, toast } = useUI();
  const { t, locale } = useT();
  const a = t.account;
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const who = wallet.publicKey?.toBase58();

  const load = useCallback(async () => {
    if (!who) return setItems(null);
    const subs = await fetchSubscriptionsBySubscriber(rpc(), address(who));
    const plans = await fetchMultipleAccountBytes(rpc(), subs.map((s) => s.plan));
    const merchants = await fetchMultipleAccountBytes(rpc(), subs.map((s) => s.merchant));
    const tokens = await fetchMultipleAccountBytes(rpc(), subs.map((s) => s.subscriberTokenAccount));
    setItems(await Promise.all(subs.map(async (s, i) => ({
      ...s,
      planName: plans[i] ? decodePlan(s.plan, plans[i]!.data).name : a.fallbackPlan,
      merchantName: merchants[i] ? decodeMerchant(s.merchant, merchants[i]!.data).name : a.fallbackMerchant,
      health: await getPaymentHealth(s, tokens[i] ? decodeTokenAccount(tokens[i]!.data) : null),
    }))));
  }, [who, a]);
  useEffect(() => { load().catch((e) => toast({ tone: "error", title: a.loadFailed, body: explain(e, locale) })); }, [load, toast, a, locale]);

  async function run(key: string, title: string, build: () => Promise<Parameters<typeof signAndSend>[1]>) {
    setBusy(key);
    try {
      const sig = await signAndSend(wallet, await build());
      toast({ tone: "ok", title, href: explorerTx(sig) });
      await load();
    } catch (e) { toast({ tone: "error", title: a.failed, body: explain(e, locale) }); }
    finally { setBusy(null); }
  }
  const signer = () => noopSigner(address(who!));
  const needsRestore = items?.some((i) => i.health === "delegate_missing" || i.health === "allowance_low");
  const now = nowSecs();

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5 sm:px-8" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-2"><LangSwitch /><WalletButton /></div>
      </header>
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-6 sm:px-8">
        <h1 className="display text-[clamp(34px,5vw,52px)] font-semibold">{a.title}</h1>
        <p className="mt-2 max-w-xl text-[15px] text-mute">{a.lead}</p>

        {!who ? (
          <div className="mt-10 rounded-[24px] border border-line bg-deep/60 p-8">
            <p className="text-[15px] text-mute">{a.connectPrompt}</p>
            <button onClick={openConnect} className="mt-5 rounded-full bg-fg px-5 py-2.5 text-[14px] font-medium text-ink hover:bg-white">{t.common.connectWallet}</button>
          </div>
        ) : items === null ? (
          <p className="mt-10 text-mute">{t.common.loading}</p>
        ) : items.length === 0 ? (
          <p className="mt-10 rounded-[24px] border border-line p-8 text-[15px] text-mute">{a.empty}</p>
        ) : (
          <>
            {needsRestore && (
              <div className="mt-8 flex flex-col gap-4 rounded-[24px] border border-amber/30 bg-amber/5 p-5 sm:flex-row sm:items-center">
                <p className="flex-1 text-[14px] leading-relaxed text-amber">
                  {a.restoreNote}
                </p>
                <button onClick={() => run("restore", a.restored, () => buildRestoreInstructions({ rpc: rpc(), subscriber: signer() }))}
                  disabled={busy === "restore"} className="rounded-full bg-amber px-5 py-2.5 text-[14px] font-semibold text-ink disabled:opacity-60">
                  {busy === "restore" ? t.common.confirmInWallet : a.restore}
                </button>
              </div>
            )}
            <ul className="mt-8 divide-y divide-line border-y border-line">
              {items.map((s) => {
                const status = getSubscriptionStatus(s, now);
                const elapsed = Number(now - (s.nextChargeAt - s.periodSecs)) / Number(s.periodSecs);
                const tone = status === "lapsed" ? "var(--color-coral)" : s.health !== "ok" || status === "past_due" ? "var(--color-amber)" : "var(--color-usdc)";
                return (
                  <li key={s.address} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <Ring progress={elapsed} tone={tone} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[16px] font-semibold">{s.merchantName}</span>
                          <StatusPill status={status} />
                        </div>
                        <div className="text-[14px] text-mute">{s.planName}, {usdc(s.amount)} USDC {period(s.periodSecs, locale).adverb}</div>
                        <div className="text-[13px] text-dim">
                          {status === "completed" ? a.allPaid : status === "lapsed" ? a.pausedMissed : a.nextPayment(relative(s.nextChargeAt, undefined, locale), dateTime(s.nextChargeAt, locale))}
                          {s.maxCycles > 0n && `. ${a.cyclesPaid(s.cyclesPaid, s.maxCycles)}`}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => confirm(a.confirmCancel(s.planName, s.merchantName)) &&
                        run(s.address, a.cancelled, () => buildCancelInstructions({ rpc: rpc(), subscriber: signer(), subscription: s }))}
                      disabled={busy === s.address}
                      className="self-start rounded-full border border-line px-4 py-2 text-[14px] text-mute hover:border-coral/60 hover:text-coral disabled:opacity-50 sm:self-auto">
                      {busy === s.address ? t.common.cancelling : t.common.cancel}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
