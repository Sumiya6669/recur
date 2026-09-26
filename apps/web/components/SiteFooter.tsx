"use client";
import Link from "next/link";
import { Logo } from "./Logo";
import { LangSwitch } from "./LangSwitch";
import { useT } from "@/lib/i18n/client";

const REPO = "https://github.com/Sumiya6669/recur";

export function SiteFooter({ className = "max-w-6xl" }: { className?: string }) {
  const { t } = useT();
  return (
    <footer className={`mx-auto flex flex-col gap-5 px-5 py-10 text-[14px] text-dim sm:flex-row sm:items-center sm:justify-between sm:px-8 ${className}`}
      style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}>
      <div className="flex items-center gap-4">
        <Logo className="opacity-70" />
        <span className="hidden md:inline">{t.footer.tagline}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/account" className="hover:text-fg">{t.common.mySubscriptions}</Link>
          <Link href="/status" className="hover:text-fg">{t.footer.status}</Link>
          <a href={`${REPO}/blob/main/docs/webhooks.md`} className="hover:text-fg">{t.footer.docs}</a>
          <a href={REPO} className="hover:text-fg">GitHub</a>
          <Link href="/legal" className="hover:text-fg">{t.footer.legal}</Link>
        </nav>
        <LangSwitch />
      </div>
    </footer>
  );
}
