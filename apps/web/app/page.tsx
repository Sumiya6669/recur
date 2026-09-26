"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Orbit, type OrbitItem } from "@/components/Orbit";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { APP_URL } from "@/lib/config";
import { useT } from "@/lib/i18n/client";
import { LangSwitch } from "@/components/LangSwitch";

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

/** The hero orbit resumes where the visitor left it: dots keep their places and the total keeps growing. */
const ORBIT_KEY = "recur.landing.orbit.v1";
const START = { elapsed: 0, collected: 12_480 };

function loadOrbit(): typeof START {
  try {
    const v = JSON.parse(localStorage.getItem(ORBIT_KEY) ?? "null");
    if (v && Number.isFinite(v.elapsed) && Number.isFinite(v.collected) && v.collected >= START.collected) return v;
  } catch {}
  return START;
}

export default function Landing() {
  const items = useMemo(liveItems, []);
  const { t } = useT();
  const L = t.landing;
  const [resumed, setResumed] = useState<typeof START | null>(null);
  const [collected, setCollected] = useState(START.collected);
  const [last, setLast] = useState<string | null>(null);
  const elapsedRef = useRef(0);
  const collectedRef = useRef(START.collected);

  useEffect(() => {
    const saved = loadOrbit();
    elapsedRef.current = saved.elapsed;
    collectedRef.current = saved.collected;
    setCollected(saved.collected);
    setResumed(saved);
    const save = () => {
      try { localStorage.setItem(ORBIT_KEY, JSON.stringify({ elapsed: elapsedRef.current, collected: collectedRef.current })); } catch {}
    };
    const onHide = () => { if (document.visibilityState === "hidden") save(); };
    const timer = window.setInterval(save, 2000);
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  return (
    <div className="relative overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        <Logo />
        <nav className="flex items-center gap-1 text-[14px] sm:gap-2">
          <a href="#developers" className="hidden rounded-full px-3 py-2 text-mute hover:text-fg md:block">{t.common.developers}</a>
          <Link href="/account" className="hidden rounded-full px-3 py-2 text-mute hover:text-fg sm:block">{t.common.mySubscriptions}</Link>
          <LangSwitch className="mr-1" />
          <Link href="/dashboard" className="rounded-full border border-line px-4 py-2 hover:border-mute">{t.common.dashboard}</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-6 lg:pb-24 lg:pt-10">
        <div className="max-w-xl">
          <h1 className="display text-[clamp(44px,7.4vw,88px)] font-bold">
            {L.headline}
          </h1>
          <p className="mt-6 max-w-[34rem] text-[18px] leading-relaxed text-mute">
            {L.lead}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/dashboard?demo=1"
              className="rounded-full bg-usdc px-6 py-3 text-[15px] font-semibold text-white shadow-[0_8px_30px_-8px] shadow-usdc/60 transition hover:brightness-110">
              {L.openDemo}
            </Link>
            <Link href="/dashboard" className="rounded-full border border-line px-6 py-3 text-[15px] font-medium hover:border-mute">
              {L.start}
            </Link>
          </div>
          <p className="mt-10 max-w-md border-l-2 border-line pl-4 text-[14px] leading-relaxed text-dim">
            {L.orbitHint(t.common.now)}
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-[560px]">
          <Orbit
            key={resumed ? "resumed" : "initial"}
            items={items}
            lanes={["Pro monthly", "Weekly pass", "Desk"]}
            live={{
              speed: (30 * DAY) / 45,
              startElapsed: resumed?.elapsed ?? 0,
              elapsedRef,
              onCharge: (it) => {
                if (!resumed) return;
                collectedRef.current += it.amount;
                setCollected(collectedRef.current);
                setLast(L.chargedFrom(it.amount, it.detail ?? ""));
              },
            }}
          >
            <div className={`numeral text-[clamp(40px,7vw,72px)] text-fg ${resumed ? "" : "invisible"}`}>${collected.toLocaleString("en-US")}</div>
            <div className="mt-2 text-[13px] text-mute">{L.collectedThisYear}</div>
            <div className="mt-3 h-5 text-[13px] font-medium text-usdc-soft tabular" aria-live="polite">{last}</div>
          </Orbit>
        </div>
      </section>

      {/* How it works — a real sequence */}
      <section className="border-t border-line/70 bg-deep/40">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="display max-w-2xl text-[clamp(32px,4.5vw,52px)] font-semibold">{L.howTitle}</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {L.how.map(([title, d], i) => (
              <li key={title} className="relative">
                <div className="numeral text-[64px] text-line">{i + 1}</div>
                <h3 className="mt-3 text-[20px] font-semibold">{title}</h3>
                <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-mute">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Guarantees */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="display max-w-3xl text-[clamp(32px,4.5vw,52px)] font-semibold">
          {L.guaranteesTitle}
        </h2>
        <dl className="mt-12 grid border-t border-line sm:grid-cols-2">
          {L.guarantees.map(([title, d], i) => (
            <div key={title} className={`border-b border-line py-7 sm:pr-10 ${i % 2 ? "sm:border-l sm:pl-10" : ""}`}>
              <dt className="text-[18px] font-semibold">{title}</dt>
              <dd className="mt-2 max-w-md text-[15px] leading-relaxed text-mute">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Developers */}
      <section id="developers" className="border-t border-line/70 bg-deep/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="display text-[clamp(32px,4.5vw,52px)] font-semibold">{L.devTitle}</h2>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-mute">
              {L.devBody}
            </p>
            <Link href="/dashboard?demo=1" className="mt-8 inline-block rounded-full border border-line px-5 py-2.5 text-[14px] hover:border-mute">
              {L.seeDashboard}
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
