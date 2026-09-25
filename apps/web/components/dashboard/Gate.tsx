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
import { Orbit } from "../Orbit";

export function Gate({ children }: { children: ReactNode }) {
  const { data } = useDashboard();
  if (data.state === "ready") return <>{children}</>;
  if (data.state === "loading") return <Loading />;
  if (data.state === "error") return <Empty title="Couldn't load your account" body={`The RPC returned: ${data.message}. Check NEXT_PUBLIC_RPC_URL and reload.`} />;
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
  return (
    <Empty title="Connect your merchant wallet" body="The wallet you connect owns your plans and receives payments. You can point payouts to a multisig later.">
      <button onClick={openConnect} className="rounded-full bg-fg px-5 py-2.5 text-[14px] font-medium text-ink hover:bg-white">Connect wallet</button>
      <Link href="/dashboard?demo=1" className="rounded-full border border-line px-5 py-2.5 text-[14px] hover:border-mute">Explore with sample data</Link>
    </Empty>
  );
}

function Onboarding({ authority }: { authority: string }) {
  const wallet = useWallet();
  const { reload } = useDashboard();
  const { toast } = useUI();
  const [name, setName] = useState("");
  const [payout, setPayout] = useState(authority);
  const [busy, setBusy] = useState(false);
  const bytes = new TextEncoder().encode(name).length;

  async function create() {
    setBusy(true);
    try {
      let settlementWallet;
      try { settlementWallet = address(payout.trim()); } catch { throw new Error("Payout wallet isn't a valid Solana address."); }
      const sig = await signAndSend(wallet, [
        await getInitMerchantInstruction({ authority: noopSigner(address(authority)), settlementWallet, name }),
      ]);
      toast({ tone: "ok", title: "Merchant account created", href: explorerTx(sig) });
      await reload();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't create the account", body: explain(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-[8dvh] max-w-lg">
      <h1 className="display text-[40px] font-semibold">Set up your business</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-mute">
        This creates your merchant account on Solana. Subscribers see the name at checkout.
      </p>
      <div className="mt-8 space-y-5">
        <label className="block">
          <span className="text-[14px] font-medium">Business name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alpha Signals" maxLength={40}
            className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 text-[15px] outline-none placeholder:text-dim focus:border-usdc" />
          <span className={`mt-1 block text-[12px] ${bytes > 32 ? "text-coral" : "text-dim"}`}>{bytes}/32 bytes</span>
        </label>
        <label className="block">
          <span className="text-[14px] font-medium">Payout wallet</span>
          <input value={payout} onChange={(e) => setPayout(e.target.value)} spellCheck={false}
            className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-mono text-[13px] outline-none focus:border-usdc" />
          <span className="mt-1 block text-[12px] text-dim">USDC from subscriptions lands here. A Squads vault works too.</span>
        </label>
        <button onClick={create} disabled={busy || !name.trim() || bytes > 32}
          className="w-full rounded-full bg-usdc py-3 text-[15px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
          {busy ? "Confirm in your wallet…" : "Create merchant account"}
        </button>
      </div>
    </div>
  );
}
