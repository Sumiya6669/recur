"use client";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUI } from "@/app/providers";
import { short } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

export function WalletButton({ className = "" }: { className?: string }) {
  const { publicKey, disconnect, connecting, wallet } = useWallet();
  const { openConnect } = useUI();
  const { t } = useT();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  if (!publicKey) {
    return (
      <button onClick={openConnect} disabled={connecting}
        className={`rounded-full bg-fg px-4 py-2 text-[14px] font-medium text-ink transition hover:bg-white disabled:opacity-60 ${className}`}>
        {connecting ? t.common.connecting : t.common.connectWallet}
      </button>
    );
  }
  const a = publicKey.toBase58();
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button onClick={() => setMenu((m) => !m)} aria-expanded={menu}
        className="flex items-center gap-2 rounded-full border border-line bg-deep px-3 py-1.5 text-[14px] hover:border-mute">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {wallet && <img src={wallet.adapter.icon} alt="" className="size-5 rounded" />}
        <span className="font-mono text-[13px]">{short(a)}</span>
      </button>
      {menu && (
        <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-raise shadow-2xl shadow-black/50">
          <button className="block w-full px-4 py-2.5 text-left text-[14px] hover:bg-deep"
            onClick={() => { navigator.clipboard.writeText(a); setMenu(false); }}>{t.common.copyAddress}</button>
          <button className="block w-full px-4 py-2.5 text-left text-[14px] text-coral hover:bg-deep"
            onClick={() => { disconnect(); setMenu(false); }}>{t.common.disconnect}</button>
        </div>
      )}
    </div>
  );
}
