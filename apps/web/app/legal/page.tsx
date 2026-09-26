import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { CLUSTER } from "@/lib/config";

export const metadata: Metadata = { title: "Terms and privacy" };

const REPO = "https://github.com/Sumiya6669/recur";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="display text-[24px] font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-mute">{children}</div>
    </section>
  );
}

export default function Legal() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-8" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
        <Link href="/"><Logo /></Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:px-8">
        <h1 className="display text-[clamp(34px,5vw,52px)] font-semibold">Terms and privacy</h1>
        <p className="mt-2 text-[15px] text-mute">Plain-language summary of how Recur works and what it does with data.</p>

        {CLUSTER !== "mainnet" && (
          <p className="mt-8 rounded-2xl border border-amber/30 bg-amber/5 p-4 text-[14px] text-amber">
            This deployment runs on Solana {CLUSTER}. Tokens here have no value, and plans and subscriptions can be reset.
          </p>
        )}

        <Section title="What Recur is">
          <p>
            Recur is open-source software: a Solana program, a website and a keeper service. It lets a business charge a fixed USDC
            amount on a fixed schedule from a wallet whose owner approved it. Recur never holds funds. Payments go directly from the
            subscriber&apos;s token account to the business&apos;s account in one transaction.
          </p>
        </Section>

        <Section title="Subscribers">
          <p>
            When you subscribe you approve a capped amount of USDC for the Recur program and pay the first period. The program only
            lets that approval be used for the price, schedule and business you agreed to. You can cancel from any wallet at any time
            at <Link href="/account" className="underline underline-offset-4 hover:text-fg">My subscriptions</Link>, which stops future
            payments and reduces or revokes the approval. Past payments are between you and the business; Recur can&apos;t reverse them.
          </p>
        </Section>

        <Section title="Businesses">
          <p>
            You are responsible for what you sell, for describing it accurately and for handling refunds and support. You can pause a
            plan at any time; existing subscribers keep their locked price until they cancel.
          </p>
        </Section>

        <Section title="Privacy">
          <p>
            Recur has no user accounts and stores no personal data. Subscriptions live on the Solana blockchain, where wallet
            addresses, amounts and payment times are public by design.
          </p>
          <p>
            The site is hosted on Vercel and reads the chain through an RPC provider; both see standard request data such as IP
            addresses. Your wallet app has its own privacy policy. Businesses that use Recur webhooks receive your wallet address
            and payment events.
          </p>
        </Section>

        <Section title="No warranty">
          <p>
            The software is provided as is under the MIT license, without warranties of any kind. Smart contracts can have bugs;
            only approve amounts you are comfortable with. The code and a security review are public on{" "}
            <a href={REPO} className="underline underline-offset-4 hover:text-fg">GitHub</a>.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or security reports: open an issue on <a href={`${REPO}/issues`} className="underline underline-offset-4 hover:text-fg">GitHub</a>.
          </p>
        </Section>
      </main>
      <SiteFooter className="max-w-3xl" />
    </div>
  );
}
