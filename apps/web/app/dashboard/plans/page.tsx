"use client";
import { useEffect, useRef, useState } from "react";
import { address } from "@solana/kit";
import { useWallet } from "@solana/wallet-adapter-react";
import { buildCreatePlanInstructions, getSetPlanActiveInstruction, noopSigner, toBaseUnits, type PlanAccount } from "@recur/sdk";
import { useDashboard } from "@/components/dashboard/context";
import { APP_URL, USDC, explorerTx, rpc } from "@/lib/config";
import { money, period, usdc } from "@/lib/format";
import { signAndSend } from "@/lib/send";
import { explain } from "@/lib/errors";
import { useUI } from "@/app/providers";

const PERIODS = [
  { id: "month", label: "Monthly", secs: 30n * 86400n, grace: 3n * 86400n },
  { id: "week", label: "Weekly", secs: 7n * 86400n, grace: 86400n },
  { id: "year", label: "Yearly", secs: 365n * 86400n, grace: 7n * 86400n },
  { id: "demo", label: "Every 2 minutes (for demos)", secs: 120n, grace: 60n },
];

export default function Plans() {
  const { ready, demo, reload } = useDashboard();
  const wallet = useWallet();
  const { toast } = useUI();
  const r = ready!;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const copy = (text: string, title: string) => { navigator.clipboard.writeText(text); toast({ tone: "ok", title }); };

  async function toggle(p: PlanAccount) {
    if (demo) return toast({ tone: "info", title: "Sample data", body: "Connect your wallet to manage real plans." });
    setBusy(p.address);
    try {
      const sig = await signAndSend(wallet, [await getSetPlanActiveInstruction({
        authority: noopSigner(address(wallet.publicKey!.toBase58())), plan: p.address, active: !p.active,
      })]);
      toast({ tone: "ok", title: p.active ? "Plan paused" : "Plan resumed", href: explorerTx(sig) });
      await reload();
    } catch (e) { toast({ tone: "error", title: "Couldn't update the plan", body: explain(e) }); }
    finally { setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[clamp(30px,4vw,44px)] font-semibold">Plans</h1>
          <p className="mt-1 max-w-xl text-[15px] text-mute">Prices are locked for everyone who subscribes. To change a price, create a new plan and pause the old one.</p>
        </div>
        <button onClick={() => (demo ? toast({ tone: "info", title: "Sample data", body: "Connect your wallet to create plans." }) : setOpen(true))}
          className="rounded-full bg-usdc px-5 py-2.5 text-[14px] font-semibold text-white hover:brightness-110">
          Create plan
        </button>
      </div>

      <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {r.plans.map((p) => {
          const b = r.metrics.byPlan.get(p.address);
          const link = `${APP_URL}/pay/${p.address}`;
          return (
            <li key={p.address} className={`flex flex-col rounded-[24px] border p-6 ${p.active ? "border-line bg-deep/60" : "border-line/60 bg-ink opacity-75"}`}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[18px] font-semibold">{p.name}</h2>
                {!p.active && <span className="rounded-full bg-mute/10 px-2.5 py-0.5 text-[12px] text-mute">Paused</span>}
              </div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="numeral text-[56px]">{usdc(p.amount)}</span>
                <span className="text-[14px] text-mute">USDC / {period(p.periodSecs).every}</span>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-y-1 text-[13px]">
                <dt className="text-dim">Subscribers</dt><dd className="tabular text-right">{b?.active ?? 0}</dd>
                <dt className="text-dim">Monthly revenue</dt><dd className="tabular text-right">{money(b?.mrr ?? 0)}</dd>
                <dt className="text-dim">Grace period</dt><dd className="text-right">{p.graceSecs ? period(p.graceSecs).span : "None"}</dd>
              </dl>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
                <button onClick={() => copy(link, "Checkout link copied")} className="rounded-full bg-raise px-3.5 py-1.5 text-[13px] hover:bg-line">Copy checkout link</button>
                <button onClick={() => copy(`https://dial.to/?action=solana-action:${encodeURIComponent(`${APP_URL}/api/actions/subscribe/${p.address}`)}`, "Blink link copied")}
                  className="rounded-full bg-raise px-3.5 py-1.5 text-[13px] hover:bg-line">Copy Blink</button>
                <button onClick={() => toggle(p)} disabled={busy === p.address}
                  className="ml-auto rounded-full px-3 py-1.5 text-[13px] text-mute hover:text-fg disabled:opacity-50">
                  {busy === p.address ? "Saving…" : p.active ? "Pause" : "Resume"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <CreatePlanDialog open={open} onClose={() => setOpen(false)} onCreated={reload} />
    </div>
  );
}

function CreatePlanDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const wallet = useWallet();
  const { ready } = useDashboard();
  const { toast } = useUI();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [per, setPer] = useState("month");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const valid = name.trim() && new TextEncoder().encode(name).length <= 32 && Number(price) > 0;
  const chosen = PERIODS.find((p) => p.id === per)!;

  async function create() {
    setBusy(true);
    try {
      const ixs = await buildCreatePlanInstructions({
        rpc: rpc(), authority: noopSigner(address(wallet.publicKey!.toBase58())), merchant: ready!.merchant, mint: USDC,
        amount: toBaseUnits(price), periodSecs: chosen.secs, graceSecs: chosen.grace, name,
      });
      const sig = await signAndSend(wallet, ixs);
      toast({ tone: "ok", title: "Plan created", body: "Copy the checkout link to start selling.", href: explorerTx(sig) });
      setName(""); setPrice("");
      onClose();
      onCreated();
    } catch (e) { toast({ tone: "error", title: "Couldn't create the plan", body: explain(e) }); }
    finally { setBusy(false); }
  }

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(94vw,460px)] rounded-3xl border border-line bg-deep p-0 text-fg shadow-2xl shadow-black/60 backdrop:bg-ink/70 backdrop:backdrop-blur-sm">
      <div className="p-6 sm:p-7">
        <h2 className="display text-[28px] font-semibold">New plan</h2>
        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="text-[14px] font-medium">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pro monthly"
              className="mt-2 w-full rounded-xl border border-line bg-ink/50 px-4 py-3 text-[15px] outline-none placeholder:text-dim focus:border-usdc" />
          </label>
          <label className="block">
            <span className="text-[14px] font-medium">Price</span>
            <div className="mt-2 flex items-center rounded-xl border border-line bg-ink/50 focus-within:border-usdc">
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="19.00"
                className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-dim" />
              <span className="pr-4 text-[14px] text-mute">USDC</span>
            </div>
          </label>
          <fieldset>
            <legend className="text-[14px] font-medium">Charge</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PERIODS.map((p) => (
                <label key={p.id} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-[13px] ${per === p.id ? "border-usdc bg-usdc/10" : "border-line hover:border-mute"} ${p.id === "demo" ? "col-span-2" : ""}`}>
                  <input type="radio" name="per" className="sr-only" checked={per === p.id} onChange={() => setPer(p.id)} />
                  {p.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-dim">Subscribers keep access for {period(chosen.grace).span} after a missed payment.</p>
          </fieldset>
        </div>
        <div className="mt-7 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-full border border-line py-3 text-[14px] hover:border-mute">Cancel</button>
          <button onClick={create} disabled={!valid || busy}
            className="flex-1 rounded-full bg-usdc py-3 text-[14px] font-semibold text-white hover:brightness-110 disabled:opacity-50">
            {busy ? "Confirm in wallet…" : "Create plan"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
