"use client";
import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useT } from "@/lib/i18n/client";

export function ConnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { wallets, select, connected } = useWallet();
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => { if (connected && open) onClose(); }, [connected, open, onClose]);

  const installed = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(92vw,400px)] rounded-3xl border border-line bg-deep p-0 text-fg shadow-2xl shadow-black/60 backdrop:bg-ink/70 backdrop:backdrop-blur-sm">
      <div className="p-6">
        <h2 className="display text-[26px] font-semibold">{t.connect.title}</h2>
        <p className="mt-1 text-[14px] text-mute">{t.connect.body}</p>
        <ul className="mt-5 flex flex-col gap-2">
          {installed.map((w) => (
            <li key={w.adapter.name}>
              <button onClick={() => select(w.adapter.name)}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-ink/40 px-4 py-3 text-left transition-colors hover:border-usdc/60 hover:bg-raise">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.adapter.icon} alt="" className="size-8 rounded-lg" />
                <span className="font-medium">{w.adapter.name}</span>
                <span className="ml-auto text-[12px] text-dim">{t.connect.detected}</span>
              </button>
            </li>
          ))}
        </ul>
        {installed.length === 0 && (
          <div className="mt-5 rounded-2xl border border-line bg-ink/40 p-4 text-[14px] text-mute">
            {t.connect.none}{" "}
            <a className="text-usdc-soft underline underline-offset-4" href="https://phantom.com" target="_blank" rel="noreferrer">Phantom</a>,{" "}
            <a className="text-usdc-soft underline underline-offset-4" href="https://solflare.com" target="_blank" rel="noreferrer">Solflare</a>,{" "}
            <a className="text-usdc-soft underline underline-offset-4" href="https://backpack.app" target="_blank" rel="noreferrer">Backpack</a>.
          </div>
        )}
        <button onClick={onClose} className="mt-5 w-full rounded-full py-2.5 text-[14px] text-mute hover:text-fg">{t.connect.notNow}</button>
      </div>
    </dialog>
  );
}
