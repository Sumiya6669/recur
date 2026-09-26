"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Orbit, OrbitLegend, type OrbitItem } from "@/components/Orbit";
import { useDashboard } from "@/components/dashboard/context";
import { money, period, relative, short, usdc } from "@/lib/format";
import { APP_URL } from "@/lib/config";
import { useUI } from "@/app/providers";
import { useT } from "@/lib/i18n/client";


export default function Overview() {
  const { ready, href } = useDashboard();
  const { toast } = useUI();
  const { t, locale } = useT();
  const o = t.dash.overview;
  const r = ready!;
  const m = r.metrics;
  const nowN = Number(r.now);

  const items = useMemo<OrbitItem[]>(() => {
    const lane = new Map(r.plans.map((p, i) => [p.address, i]));
    return m.rows
      .filter((x) => x.status !== "lapsed" && x.status !== "completed")
      .map((x) => ({
        id: x.address,
        lane: lane.get(x.plan) ?? 0,
        secsUntil: Number(x.nextChargeAt) - nowN,
        amount: Number(x.amount) / 1e6,
        health: x.status === "past_due" ? "failed" : x.atRisk ? "risk" : "ok",
        label: o.dotLabel(usdc(x.amount), x.planName),
        detail: `${x.status === "past_due" ? o.dotOverdue(short(x.subscriber)) : o.dotPays(short(x.subscriber), relative(x.nextChargeAt, nowN, locale))}${x.health !== "ok" ? `. ${t.health[x.health]}` : ""}`,
      }));
  }, [m.rows, r.plans, nowN, o, t, locale]);

  const nextCharge = m.upcoming.find((u) => Number(u.nextChargeAt) >= nowN);
  const attention = m.rows
    .filter((x) => x.atRisk || x.status === "past_due")
    .sort((a, b) => Number(a.nextChargeAt - b.nextChargeAt))
    .slice(0, 6);
  const totalPlanMrr = [...m.byPlan.values()].reduce((s, b) => s + b.mrr, 0) || 1;

  if (r.plans.length === 0) {
    return (
      <div className="mx-auto mt-[10dvh] max-w-md text-center">
        <h1 className="display text-[38px] font-semibold">{o.firstPlanTitle}</h1>
        <p className="mt-3 text-[15px] text-mute">{o.firstPlanBody}</p>
        <Link href={href("/dashboard/plans")} className="mt-8 inline-block rounded-full bg-usdc px-6 py-3 text-[15px] font-semibold text-white">{o.firstPlanCta}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[clamp(30px,4vw,44px)] font-semibold">{r.merchant.name}</h1>
          <p className="mt-1 text-[15px] text-mute">
            {nextCharge
              ? o.nextPayment(relative(nextCharge.nextChargeAt, nowN, locale), usdc(nextCharge.amount), short(nextCharge.subscriber))
              : o.noneThisWeek}
          </p>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(`${APP_URL}/pay/${r.plans[0].address}`); toast({ tone: "ok", title: o.checkoutCopied, body: r.plans[0].name }); }}
          className="rounded-full border border-line px-4 py-2 text-[14px] hover:border-mute">
          {o.copyCheckout}
        </button>
      </div>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        {/* Orbit */}
        <div className="rounded-[28px] border border-line bg-deep/60 p-4 sm:p-8">
          <div className="mx-auto max-w-[620px]">
            <Orbit items={items} lanes={r.plans.map((p) => p.name)}>
              <div className="numeral text-[clamp(44px,8vw,84px)]">{money(m.mrr)}</div>
              <div className="mt-2 text-[13px] text-mute">{o.mrr}</div>
            </Orbit>
          </div>
          <div className="mt-4"><OrbitLegend lanes={r.plans.slice(0, 4).map((p) => p.name)} /></div>
        </div>

        {/* Metrics */}
        <div className="flex flex-col">
          <dl className="divide-y divide-line border-y border-line">
            {[
              [o.collected, money(m.collected), o.collectedSub],
              [o.expected, money(m.forecast), o.expectedSub(m.upcoming.length)],
              [o.activeSubs, m.active.toLocaleString("en-US"), o.lapsedSub(m.lapsed)],
            ].map(([k, v, s]) => (
              <div key={k} className="py-5">
                <dt className="text-[14px] text-mute">{k}</dt>
                <dd className="numeral mt-2 text-[44px]">{v}</dd>
                <dd className="mt-1 text-[13px] text-dim">{s}</dd>
              </div>
            ))}
            <div className="py-5">
              <dt className="text-[14px] text-mute">{o.attention}</dt>
              <dd className={`numeral mt-2 text-[44px] ${m.atRisk ? "text-amber" : ""}`}>{m.atRisk}</dd>
              <dd className="mt-1 text-[13px] text-dim">
                {m.atRisk ? <Link href={href("/dashboard/subscribers")} className="underline underline-offset-4 hover:text-fg">{o.review}</Link> : o.allFine}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            <h2 className="text-[14px] text-mute">{o.byPlan}</h2>
            <ul className="mt-3 space-y-3">
              {r.plans.map((p) => {
                const b = m.byPlan.get(p.address) ?? { active: 0, mrr: 0 };
                return (
                  <li key={p.address}>
                    <div className="flex items-baseline justify-between gap-3 text-[14px]">
                      <span className="truncate">{p.name}</span>
                      <span className="tabular text-mute">{money(b.mrr)}<span className="text-dim"> {o.perMonth}</span></span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/60">
                      <div className="h-full rounded-full bg-usdc" style={{ width: `${(b.mrr / totalPlanMrr) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="display text-[24px] font-semibold">{o.next7}</h2>
          {m.upcoming.length === 0 ? (
            <p className="mt-4 text-[14px] text-mute">{o.nothingThisWeek}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {m.upcoming.slice(0, 8).map((u) => (
                <li key={u.address} className="flex items-center gap-4 py-3 text-[14px]">
                  <span className={`size-2 shrink-0 rounded-full ${u.status === "past_due" ? "bg-coral" : u.atRisk ? "bg-amber" : "bg-usdc"}`} />
                  <span className="w-28 shrink-0 text-mute">{relative(u.nextChargeAt, nowN, locale)}</span>
                  <span className="min-w-0 flex-1 truncate">{u.planName}</span>
                  <span className="hidden font-mono text-[12px] text-dim sm:block">{short(u.subscriber)}</span>
                  <span className="tabular w-20 text-right">{usdc(u.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="display text-[24px] font-semibold">{o.attention}</h2>
          {attention.length === 0 ? (
            <p className="mt-4 text-[14px] text-mute">{o.attentionEmpty}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {attention.map((a) => (
                <li key={a.address} className="flex items-center gap-4 py-3 text-[14px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{a.status === "past_due" ? o.overduePayment : t.health[a.health]}</span>
                    <span className="block text-[13px] text-dim">
                      {a.planName}, {usdc(a.amount)} USDC {period(a.periodSecs, locale).adverb}
                    </span>
                  </span>
                  <span className="font-mono text-[12px] text-dim">{short(a.subscriber)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[13px] text-dim">
            {o.attentionNote}
          </p>
        </div>
      </section>
    </div>
  );
}
