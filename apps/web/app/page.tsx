"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Orbit, type OrbitItem } from "@/components/Orbit";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { APP_URL } from "@/lib/config";

const DAY = 86400;

function liveItems(): OrbitItem[] {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const plans = [
    { lane: 0, period: 30 * DAY, amount: 19, n: 22, name: "Pro monthly" },
    { lane: 1, period: 7 * DAY, amount: 5, n: 9, name: "Weekly pass" },
    { lane: 2, period: 30 * DAY, amount: 49, n: 7, name: "Desk" },
  ];
  return plans.flatMap((p) =>
    Array.from({ length: p.n }, (_, i) => ({
      id: `${p.lane}-${i}`,
      lane: p.lane,
      periodSecs: p.period,
      secsUntil: rand() * p.period,
      amount: p.amount,
      health: (rand() > 0.9 ? "risk" : "ok") as OrbitItem["health"],
      label: `${p.amount} USDC`,
      detail: p.name,
    })),
  );
}

export default function Landing() {
  const items = useMemo(liveItems, []);
  const [collected, setCollected] = useState(12_480);
  const [last, setLast] = useState<string | null>(null);

  return (
    <div className="relative overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        <Logo />
        <nav className="flex items-center gap-1 text-[14px] sm:gap-2">
          <a href="#developers" className="hidden rounded-full px-3 py-2 text-mute hover:text-fg sm:block">Developers</a>
          <Link href="/account" className="rounded-full px-3 py-2 text-mute hover:text-fg"><span className="sm:hidden">Account</span><span className="hidden sm:inline">My subscriptions</span></Link>
          <Link href="/dashboard" className="rounded-full border border-line px-4 py-2 hover:border-mute">Dashboard</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-6 lg:pb-24 lg:pt-10">
        <div className="max-w-xl">
          <h1 className="display text-[clamp(44px,7.4vw,88px)] font-bold">
            Get paid every month in USDC.
          </h1>
          <p className="mt-6 max-w-[34rem] text-[18px] leading-relaxed text-mute">
            Customers approve once from their own wallet. Recur collects each payment on schedule and never holds
            the funds in between.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/dashboard?demo=1"
              className="rounded-full bg-usdc px-6 py-3 text-[15px] font-semibold text-white shadow-[0_8px_30px_-8px] shadow-usdc/60 transition hover:brightness-110">
              Open live demo
            </Link>
            <Link href="/dashboard" className="rounded-full border border-line px-6 py-3 text-[15px] font-medium hover:border-mute">
              Start accepting payments
            </Link>
          </div>
          <p className="mt-10 max-w-md border-l-2 border-line pl-4 text-[14px] leading-relaxed text-dim">
            Each dot is a subscriber, each orbit a plan. When a dot reaches <span className="text-fg">now</span>, the payment is
            collected and the next one is scheduled.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[560px]">
          <Orbit
            items={items}
            lanes={["Pro monthly", "Weekly pass", "Desk"]}
            live={{
              speed: (30 * DAY) / 45,
              onCharge: (it) => { setCollected((c) => c + it.amount); setLast(`+${it.amount} USDC from ${it.detail}`); },
            }}
          >
            <div className="numeral text-[clamp(40px,7vw,72px)] text-fg">${collected.toLocaleString("en-US")}</div>
            <div className="mt-2 text-[13px] text-mute">collected this year</div>
            <div className="mt-3 h-5 text-[13px] font-medium text-usdc-soft tabular" aria-live="polite">{last}</div>
          </Orbit>
        </div>
      </section>

      {/* How it works — a real sequence */}
      <section className="border-t border-line/70 bg-deep/40">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="display max-w-2xl text-[clamp(32px,4.5vw,52px)] font-semibold">How a subscription runs</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              ["Approve once", "The customer lets Recur's program move a capped amount of USDC, for example a year of payments. Nothing leaves their wallet yet."],
              ["First payment", "In the same transaction the subscription is recorded on Solana with its price and schedule, and the first period is paid."],
              ["Collected on time", "When a period ends, the payment is collected automatically. If a wallet is short, access continues through a grace period, then pauses."],
            ].map(([t, d], i) => (
              <li key={t} className="relative">
                <div className="numeral text-[64px] text-line">{i + 1}</div>
                <h3 className="mt-3 text-[20px] font-semibold">{t}</h3>
                <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-mute">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Guarantees */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="display max-w-3xl text-[clamp(32px,4.5vw,52px)] font-semibold">
          Built so customers can say yes without trusting you with their balance
        </h2>
        <dl className="mt-12 grid border-t border-line sm:grid-cols-2">
          {[
            ["Price locked at signup", "A merchant can't raise the price for existing subscribers. A new price means a new plan."],
            ["Cancel from any wallet", "Subscribers cancel in one click and the unused authorization is reduced or revoked."],
            ["No back-billing", "If someone returns after a lapse, they pay for one new period, not for the months they missed."],
            ["Nobody can redirect funds", "Payments only go to the merchant's own account, in the amount the subscriber agreed to."],
          ].map(([t, d], i) => (
            <div key={t} className={`border-b border-line py-7 sm:pr-10 ${i % 2 ? "sm:border-l sm:pl-10" : ""}`}>
              <dt className="text-[18px] font-semibold">{t}</dt>
              <dd className="mt-2 max-w-md text-[15px] leading-relaxed text-mute">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Developers */}
      <section id="developers" className="border-t border-line/70 bg-deep/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="display text-[clamp(32px,4.5vw,52px)] font-semibold">Grant access with one request</h2>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-mute">
              Share a checkout link or a Blink. Check whether a wallet is paid up before serving a Discord role, an API key or a
              private channel. Get a signed webhook every time a payment succeeds or fails.
            </p>
            <Link href="/dashboard?demo=1" className="mt-8 inline-block rounded-full border border-line px-5 py-2.5 text-[14px] hover:border-mute">
              See the dashboard
            </Link>
          </div>
          <div className="min-w-0 space-y-4">
            <pre className="scroll-x rounded-2xl border border-line bg-ink p-5 text-[13px] leading-relaxed text-mute"><code>{`const res = await fetch(
  \`${APP_URL}/api/access?plan=\${PLAN}&wallet=\${wallet}\`
);
const { active } = await res.json();
if (active) grantRole(member);`}</code></pre>
            <pre className="scroll-x rounded-2xl border border-line bg-ink p-5 text-[13px] leading-relaxed text-mute"><code>{`POST /your-webhook
x-recur-signature: t=1759000000,v1=9f2c…

{
  "type": "payment.succeeded",
  "data": {
    "subscriber": "7xKX…3fQp",
    "amount": "19000000",
    "cycle": "4",
    "next_charge_at": 1761592000
  }
}`}</code></pre>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
