"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { address, type Address } from "@solana/kit";
import { useWallet } from "@solana/wallet-adapter-react";
import { findAssociatedTokenPda } from "@solana-program/token";
import {
  DEFAULT_BUDGET_CYCLES, buildSubscribeInstructions, decodeTokenAccount, fetchMaybeAccountBytes, fetchMerchant,
  fetchPlan, fetchSubscriptionsBySubscriber, noopSigner, requiredAllowance,
  type MerchantAccount, type PlanAccount,
} from "@recur/sdk";
import { Orbit, type OrbitItem } from "@/components/Orbit";
import { Logo } from "@/components/Logo";
import { WalletButton } from "@/components/WalletButton";
import { useUI } from "@/app/providers";
import { CLUSTER, explorerTx, rpc } from "@/lib/config";
import { dateTime, period, usdc } from "@/lib/format";
import { signAndSend } from "@/lib/send";
import { explain } from "@/lib/errors";
import { useT } from "@/lib/i18n/client";
import { LangSwitch } from "@/components/LangSwitch";

type Load = { state: "loading" } | { state: "missing" } | { state: "ok"; plan: PlanAccount; merchant: MerchantAccount };
type WalletInfo = { balance: bigint; allowance: bigint; already: boolean };

function Checkout() {
  const params = useParams<{ plan: string }>();
  const search = useSearchParams();
  const redirectUrl = (() => {
    try { const u = new URL(search.get("redirect") ?? ""); return u.protocol === "https:" ? u : null; } catch { return null; }
  })();
  const maxCycles = BigInt(Math.max(0, Number(search.get("cycles") ?? 0) | 0));
  const wallet = useWallet();
  const { openConnect, toast } = useUI();
  const { t, locale } = useT();
  const c = t.pay;
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [info, setInfo] = useState<WalletInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const plan = await fetchPlan(rpc(), address(params.plan));
        const merchant = plan && (await fetchMerchant(rpc(), plan.merchant));
        setLoad(plan && merchant ? { state: "ok", plan, merchant } : { state: "missing" });
      } catch { setLoad({ state: "missing" }); }
    })();
  }, [params.plan]);

  const who = wallet.publicKey?.toBase58();
  const refreshInfo = useCallback(async () => {
    if (!who || load.state !== "ok") return setInfo(null);
    const mintAcc = await fetchMaybeAccountBytes(rpc(), load.plan.mint);
    const [ata] = await findAssociatedTokenPda({ owner: address(who), mint: load.plan.mint, tokenProgram: mintAcc!.owner });
    const [tok, subs] = await Promise.all([fetchMaybeAccountBytes(rpc(), ata), fetchSubscriptionsBySubscriber(rpc(), address(who))]);
    setInfo({
      balance: tok ? decodeTokenAccount(tok.data).amount : 0n,
      allowance: requiredAllowance(subs, ata as Address, { add: { amount: load.plan.amount, maxCycles } }),
      already: subs.some((s) => s.plan === load.plan.address),
    });
  }, [who, load, maxCycles]);
  useEffect(() => { refreshInfo().catch(() => setInfo(null)); }, [refreshInfo]);

  const payments = load.state === "ok"
    ? Number(maxCycles > 0n ? (maxCycles < 1n + DEFAULT_BUDGET_CYCLES ? maxCycles : 1n + DEFAULT_BUDGET_CYCLES) : 1n + DEFAULT_BUDGET_CYCLES)
    : 13;
  const items = useMemo<OrbitItem[]>(() => {
    if (load.state !== "ok") return [];
    const p = Number(load.plan.periodSecs);
    const now = Date.now() / 1000;
    return Array.from({ length: payments }, (_, k) => ({
      id: String(k), lane: 0, secsUntil: k * p, amount: Math.min(40, Number(load.plan.amount) / 1e6), health: "ok" as const,
      label: k === 0 ? c.today : c.paymentN(k + 1), detail: k === 0 ? c.paidOnSubscribe : dateTime(now + k * p, locale),
    }));
  }, [load, payments, c, locale]);

  if (load.state === "loading") return <Frame><div className="mx-auto mt-24 w-48 opacity-60"><Orbit items={[]} lanes={[""]} /></div></Frame>;
  if (load.state === "missing") {
    return (
      <Frame>
        <div className="mx-auto mt-24 max-w-md text-center">
          <h1 className="display text-[34px] font-semibold">{c.brokenTitle}</h1>
          <p className="mt-3 text-mute">{c.brokenBody}</p>
        </div>
      </Frame>
    );
  }

  const { plan, merchant } = load;
  const per = period(plan.periodSecs, locale);
  const enough = info ? info.balance >= plan.amount : true;

  async function subscribe() {
    setBusy(true);
    try {
      const { instructions } = await buildSubscribeInstructions({
        rpc: rpc(), subscriber: noopSigner(address(who!)), plan, merchant, maxCycles,
      });
      const sig = await signAndSend(wallet, instructions);
      setDone(sig);
    } catch (e) {
      toast({ tone: "error", title: c.failed, body: explain(e, locale) });
      refreshInfo().catch(() => {});
    } finally { setBusy(false); }
  }

  return (
    <Frame>
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pt-10">
        <div className="relative order-1 mx-auto w-full max-w-[340px] sm:max-w-[480px]">
          <Orbit items={items} lanes={[plan.name]} windowSecs={Number(plan.periodSecs) * payments}>
            <div className="numeral text-[clamp(48px,9vw,88px)]">{usdc(plan.amount)}</div>
            <div className="mt-2 text-[14px] text-mute">USDC {per.adverb}</div>
          </Orbit>
          <p className="mt-2 text-center text-[13px] text-dim">
            {maxCycles > 0n ? c.totalPayments(maxCycles) : c.approvalCovers(payments)}
          </p>
        </div>

        <div className="rounded-[28px] border border-line bg-deep/70 p-6 sm:p-8">
          <div className="text-[14px] text-mute">{merchant.name}</div>
          <h1 className="display mt-1 text-[36px] font-semibold">{plan.name}</h1>

          {done ? (
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-usdc text-white">✓</span>
                <span className="text-[18px] font-semibold">{c.subscribed}</span>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-mute">
                {c.paidNext(usdc(plan.amount), dateTime(Date.now() / 1000 + Number(plan.periodSecs), locale))}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {redirectUrl && (
                  <a href={redirectUrl.href} rel="noreferrer" className="rounded-full bg-usdc px-5 py-2.5 text-[14px] font-semibold text-white">{c.continueTo(redirectUrl.host)}</a>
                )}
                <Link href="/account" className="rounded-full border border-line px-5 py-2.5 text-[14px] hover:border-mute">{t.common.mySubscriptions}</Link>
                <a href={explorerTx(done)} target="_blank" rel="noreferrer" className="rounded-full px-3 py-2.5 text-[14px] text-mute hover:text-fg">{c.receipt}</a>
              </div>
            </div>
          ) : (
            <>
              <dl className="mt-6 divide-y divide-line border-y border-line text-[14px]">
                <div className="flex justify-between py-3"><dt className="text-mute">{c.dueToday}</dt><dd className="tabular font-medium">{usdc(plan.amount)} USDC</dd></div>
                <div className="flex justify-between py-3"><dt className="text-mute">{c.then}</dt><dd className="tabular">{usdc(plan.amount)} USDC {per.adverb}</dd></div>
                <div className="flex justify-between gap-4 py-3"><dt className="text-mute">{c.ifMissed}</dt><dd className="text-right">{plan.graceSecs ? c.graceContinues(period(plan.graceSecs, locale).spanFor) : c.gracePauses}</dd></div>
              </dl>

              {info && (
                <p className="mt-4 text-[13px] leading-relaxed text-dim">
                  {c.approvalNote(usdc(info.allowance))}
                </p>
              )}

              <div className="mt-6">
                {!plan.active ? (
                  <p className="rounded-2xl border border-line p-4 text-[14px] text-mute">{c.notTaking}</p>
                ) : !who ? (
                  <button onClick={openConnect} className="w-full rounded-full bg-fg py-3.5 text-[15px] font-semibold text-ink hover:bg-white">{c.connectToSubscribe}</button>
                ) : info?.already ? (
                  <Link href="/account" className="block w-full rounded-full border border-line py-3.5 text-center text-[15px] hover:border-mute">{c.already}</Link>
                ) : !enough ? (
                  <div className="rounded-2xl border border-amber/30 bg-amber/5 p-4 text-[14px] text-amber">
                    {c.needFunds(usdc(plan.amount), usdc(info!.balance))}
                    {CLUSTER !== "mainnet" && (
                      <span className="mt-2 block text-mute">
                        {c.testUsdc}{" "}
                        <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="text-usdc-soft underline underline-offset-4">faucet.circle.com</a>
                      </span>
                    )}
                  </div>
                ) : (
                  <button onClick={subscribe} disabled={busy || !info}
                    className="w-full rounded-full bg-usdc py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_40px_-10px] shadow-usdc/70 transition hover:brightness-110 disabled:opacity-60">
                    {busy ? t.common.confirmInWallet : c.subscribe(usdc(plan.amount))}
                  </button>
                )}
              </div>
              <p className="mt-4 text-center text-[12px] text-dim">{c.footnote}</p>
            </>
          )}
        </div>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-2"><LangSwitch /><WalletButton /></div>
      </header>
      {children}
    </div>
  );
}

export default function Page() {
  return <Suspense><Checkout /></Suspense>;
}
