"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { WalletButton } from "@/components/WalletButton";
import { DashboardProvider, useDashboard } from "@/components/dashboard/context";
import { Gate } from "@/components/dashboard/Gate";
import { LangSwitch } from "@/components/LangSwitch";
import { useT } from "@/lib/i18n/client";

const NAV = [
  { href: "/dashboard", key: "overview" },
  { href: "/dashboard/subscribers", key: "subscribers" },
  { href: "/dashboard/plans", key: "plans" },
  { href: "/dashboard/developers", key: "developers" },
] as const;

function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { demo, href, ready } = useDashboard();
  const { t } = useT();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur lg:h-dvh lg:border-b-0 lg:border-r"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block lg:px-5 lg:py-6">
          <Link href="/" aria-label={t.dash.homeAria}><Logo /></Link>
          <div className="flex items-center gap-2 lg:hidden"><LangSwitch /><WalletButton /></div>
        </div>
        {ready && (
          <div className="hidden px-5 pb-6 lg:block">
            <div className="truncate text-[15px] font-medium">{ready.merchant.name}</div>
            <div className="text-[13px] text-dim">{t.dash.planCount(ready.plans.length)}</div>
          </div>
        )}
        <nav className="scroll-x flex gap-1 px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0">
          {NAV.map((n) => {
            const on = path === n.href;
            return (
              <Link key={n.href} href={href(n.href)} aria-current={on ? "page" : undefined}
                className={`shrink-0 rounded-xl px-3 py-2 text-[14px] transition-colors ${on ? "bg-raise text-fg" : "text-mute hover:bg-deep hover:text-fg"}`}>
                {t.dash.nav[n.key]}
              </Link>
            );
          })}
        </nav>
        <div className="absolute inset-x-0 bottom-0 hidden flex-col gap-3 p-5 lg:flex">
          {demo && (
            <div className="rounded-2xl border border-amber/30 bg-amber/5 p-3 text-[13px] text-amber">
              {t.dash.viewingSample}{" "}
              <Link href="/dashboard" className="underline underline-offset-4">{t.dash.useWallet}</Link>
            </div>
          )}
          <LangSwitch className="self-start" />
          <WalletButton />
        </div>
      </aside>
      <main className="min-w-0 px-5 pb-16 pt-6 sm:px-8 lg:px-10 lg:pt-8" style={{ paddingBottom: "max(4rem, env(safe-area-inset-bottom))" }}>
        {demo && (
          <div className="mb-5 rounded-2xl border border-amber/30 bg-amber/5 px-4 py-2.5 text-[13px] text-amber lg:hidden">
            {t.dash.sampleShort} <Link href="/dashboard" className="underline underline-offset-4">{t.dash.useWallet}</Link>
          </div>
        )}
        <Gate>{children}</Gate>
      </main>
    </div>
  );
}

function WithParams({ children }: { children: ReactNode }) {
  const demo = useSearchParams().get("demo") === "1";
  return <DashboardProvider demo={demo}><Shell>{children}</Shell></DashboardProvider>;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <Suspense><WithParams>{children}</WithParams></Suspense>;
}
