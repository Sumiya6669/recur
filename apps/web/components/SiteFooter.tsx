import Link from "next/link";
import { Logo } from "./Logo";

const REPO = "https://github.com/Sumiya6669/recur";

export function SiteFooter({ className = "max-w-6xl" }: { className?: string }) {
  return (
    <footer className={`mx-auto flex flex-col gap-5 px-5 py-10 text-[14px] text-dim sm:flex-row sm:items-center sm:justify-between sm:px-8 ${className}`}
      style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}>
      <div className="flex items-center gap-4">
        <Logo className="opacity-70" />
        <span className="hidden md:inline">Non-custodial recurring payments on Solana. Open source.</span>
      </div>
      <nav className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/account" className="hover:text-fg">My subscriptions</Link>
        <Link href="/status" className="hover:text-fg">Status</Link>
        <a href={`${REPO}/blob/main/docs/webhooks.md`} className="hover:text-fg">Docs</a>
        <a href={REPO} className="hover:text-fg">GitHub</a>
        <Link href="/legal" className="hover:text-fg">Terms and privacy</Link>
      </nav>
    </footer>
  );
}
