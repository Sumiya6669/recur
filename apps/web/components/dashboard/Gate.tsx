"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { address } from "@solana/kit";
import { useWallet } from "@solana/wallet-adapter-react";
import { getInitMerchantInstruction, noopSigner } from "@recur/sdk";
import { useUI } from "@/app/providers";
import { signAndSend } from "@/lib/send";
import { explain } from "@/lib/errors";
import { explorerTx } from "@/lib/config";
import { useDashboard } from "./context";
import { useT } from "@/lib/i18n/client";
import { Orbit } from "../Orbit";

export function Gate({ children }: { children: ReactNode }) {
  const { data } = useDashboard();
  const { t } = useT();
  if (data.state === "ready") return <>{children}</>;
  if (data.state === "loading") return <Loading />;
  if (data.state === "error") return <Empty title={t.dash.gate.loadError} body={t.dash.gate.loadErrorBody(data.message)} />;
  if (data.state === "disconnected") return <Disconnected />;
  return <Onboarding authority={data.authority} />;
}

function Loading() {
  return (
    <div className="grid min-h-[70dvh] place-items-center">
      <div className="w-56 opacity-60"><Orbit items={[]} lanes={["", ""]} /></div>
    </div>
  );
}

function Empty({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="mx-auto mt-[12dvh] max-w-md text-center">
      <h1 className="display text-[34px] font-semibold">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-mute">{body}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  );
}

function Disconnected() {
  const { openConnect } = useUI();
  const { t } = useT();
  return (
    <Empty title={t.dash.gate.connectTitle} body={t.dash.gate.connectBody}>
      <button onClick={openConnect} className="rounded-full bg-fg px-5 py-2.5 text-[14px] font-medium text-ink hover:bg-white">{t.common.connectWallet}</button>
      <Link href="/dashboard?demo=1" className="rounded-full border border-line px-5 py-2.5 text-[14px] hover:border-mute">{t.dash.gate.explore}</Link>
    </Empty>
  );
}

function Onboarding({ authority }: { authority: string }) {
  const wallet = useWallet();
  const { reload } = useDashboard();
  const { toast } = useUI();
  const { t, locale } = useT();
  const [name, setName] = useState("");
  const [payout, setPayout] = useState(authority);
  const [busy, setBusy] = useState(false);
  const bytes = new TextEncoder().encode(name).length;

  async function create() {
    setBusy(true);
    try {
      let settlementWallet;
      try { settlementWallet = address(payout.trim()); } catch { throw new Error(t.dash.gate.payoutInvalid); }
      const sig = await signAndSend(wallet, [
        await getInitMerchantInstruction({ authority: noopSigner(address(authority)), settlementWallet, name }),
      ]);
      toast({ tone: "ok", title: t.dash.gate.created, href: explorerTx(sig) });
      await reload();
    } catch (e) {
      toast({ tone: "error", title: t.dash.gate.createFailed, body: explain(e, locale) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-[8dvh] max-w-lg">
      <h1 className="display text-[40px] font-semibold">{t.dash.gate.setupTitle}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-mute">
        {t.dash.gate.setupBody}
      </p>
      <div className="mt-8 space-y-5">
        <label className="block">
          <span className="text-[14px] font-medium">{t.dash.gate.businessName}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alpha Signals" maxLength={40}
            className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 text-[15px] outline-none placeholder:text-dim focus:border-usdc" />
          <span className={`mt-1 block text-[12px] ${bytes > 32 ? "text-coral" : "text-dim"}`}>{t.dash.gate.bytes(bytes)}</span>
        </label>
        <label className="block">
          <span className="text-[14px] font-medium">{t.dash.gate.payout}</span>
          <input value={payout} onChange={(e) => setPayout(e.target.value)} spellCheck={false}
            className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-mono text-[13px] outline-none focus:border-usdc" />
          <span className="mt-1 block text-[12px] text-dim">{t.dash.gate.payoutHint}</span>
        </label>
        <button onClick={create} disabled={busy || !name.trim() || bytes > 32}
          className="w-full rounded-full bg-usdc py-3 text-[15px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
          {busy ? t.common.confirmInWallet : t.dash.gate.create}
        </button>
      </div>
    </div>
  );
}
