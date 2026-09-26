"use client";
import { RECUR_PROGRAM_ID } from "@recur/sdk";
import { useDashboard } from "@/components/dashboard/context";
import { APP_URL, CLUSTER } from "@/lib/config";
import { useUI } from "@/app/providers";
import { useT } from "@/lib/i18n/client";

function Code({ children }: { children: string }) {
  const { toast } = useUI();
  const { t } = useT();
  return (
    <div className="group relative">
      <pre className="scroll-x rounded-2xl border border-line bg-ink p-5 text-[13px] leading-relaxed text-mute"><code>{children}</code></pre>
      <button onClick={() => { navigator.clipboard.writeText(children); toast({ tone: "ok", title: t.common.copied }); }}
        className="absolute right-3 top-3 rounded-full bg-raise px-3 py-1 text-[12px] text-mute opacity-0 transition group-hover:opacity-100 focus:opacity-100">
        {t.common.copy}
      </button>
    </div>
  );
}

export default function Developers() {
  const { ready } = useDashboard();
  const { toast } = useUI();
  const { t } = useT();
  const d = t.dash.dev;
  const r = ready!;
  const plan = r.plans[0]?.address ?? "<PLAN_ADDRESS>";
  const ids: [string, string][] = [
    [d.program, RECUR_PROGRAM_ID],
    [d.merchant, r.merchant.address],
    [d.payout, r.merchant.settlementWallet],
    ...r.plans.map((p) => [d.plan(p.name), p.address] as [string, string]),
  ];

  return (
    <div className="mx-auto max-w-[900px]">
      <h1 className="display text-[clamp(30px,4vw,44px)] font-semibold">{d.title}</h1>
      <p className="mt-1 text-[15px] text-mute">{d.lead(CLUSTER)}</p>

      <section className="mt-10">
        <h2 className="display text-[24px] font-semibold">{d.addresses}</h2>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          {ids.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-6">
              <dt className="w-48 shrink-0 text-[14px] text-mute">{k}</dt>
              <dd className="min-w-0 flex-1 truncate font-mono text-[13px]">{v}</dd>
              <button onClick={() => { navigator.clipboard.writeText(v); toast({ tone: "ok", title: t.common.copied, body: k }); }}
                className="self-start rounded-full px-3 py-1 text-[12px] text-dim hover:bg-raise hover:text-fg sm:self-auto">{t.common.copy}</button>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="display text-[24px] font-semibold">{d.accessTitle}</h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-mute">
          {d.accessBody}
        </p>
        <div className="mt-4 space-y-4">
          <Code>{`GET ${APP_URL}/api/access?plan=${plan}&wallet=<WALLET>

{ "active": true, "status": "active", "next_charge_at": 1761592000, "payments": 3 }`}</Code>
          <Code>{`import { fetchSubscription, findSubscriptionPda, hasAccess } from "@recur/sdk";

const sub = await fetchSubscription(rpc, await findSubscriptionPda(PLAN, wallet));
const active = !!sub && hasAccess(sub, BigInt(Math.floor(Date.now() / 1000)));`}</Code>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="display text-[24px] font-semibold">{d.webhooksTitle}</h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-mute">
          {d.webhooksBody}
        </p>
        <ul className="mt-4 grid gap-x-8 gap-y-2 text-[14px] sm:grid-cols-2">
          {Object.entries(d.events).map(([e, desc]) => (
            <li key={e} className="flex flex-col border-b border-line py-2">
              <span className="font-mono text-[13px] text-usdc-soft">{e}</span>
              <span className="text-mute">{desc}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Code>{`import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyRecur(body: string, header: string, secret: string) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(\`\${t}.\${body}\`).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}`}</Code>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="display text-[24px] font-semibold">{d.blinksTitle}</h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-mute">
          {d.blinksBody}
        </p>
        <div className="mt-4">
          <Code>{`${APP_URL}/api/actions/subscribe/${plan}`}</Code>
        </div>
      </section>
    </div>
  );
}
