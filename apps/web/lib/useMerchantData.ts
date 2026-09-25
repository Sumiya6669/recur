"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { address } from "@solana/kit";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  decodeTokenAccount, fetchMerchant, fetchMultipleAccountBytes, fetchPlansByMerchant,
  fetchSubscriptionsByMerchant, findMerchantPda, getPaymentHealth,
  type MerchantAccount, type PlanAccount,
} from "@recur/sdk";
import { rpc } from "./config";
import { demoData, type Sub } from "./demo";

export type MerchantData =
  | { state: "loading" }
  | { state: "disconnected" }
  | { state: "onboarding"; authority: string }
  | { state: "error"; message: string }
  | { state: "ready"; merchant: MerchantAccount; plans: PlanAccount[]; subs: Sub[]; demo: boolean };

export function useMerchantData(demo: boolean) {
  const wallet = useWallet();
  const [data, setData] = useState<MerchantData>({ state: "loading" });
  const busy = useRef(false);
  const key = wallet.publicKey?.toBase58();

  const load = useCallback(async () => {
    if (demo) return setData({ state: "ready", ...demoData(), demo: true });
    if (!key) return setData({ state: wallet.connecting ? "loading" : "disconnected" });
    if (busy.current) return;
    busy.current = true;
    try {
      const r = rpc();
      const merchantPda = await findMerchantPda(address(key));
      const merchant = await fetchMerchant(r, merchantPda);
      if (!merchant) return setData({ state: "onboarding", authority: key });
      const [plans, rawSubs] = await Promise.all([
        fetchPlansByMerchant(r, merchantPda),
        fetchSubscriptionsByMerchant(r, merchantPda),
      ]);
      const tokenAccs = await fetchMultipleAccountBytes(r, rawSubs.map((s) => s.subscriberTokenAccount));
      const subs: Sub[] = await Promise.all(
        rawSubs.map(async (s, i) => ({
          ...s,
          health: await getPaymentHealth(s, tokenAccs[i] ? decodeTokenAccount(tokenAccs[i]!.data) : null),
        })),
      );
      setData({ state: "ready", merchant, plans, subs, demo: false });
    } catch (e) {
      setData({ state: "error", message: (e as Error).message });
    } finally {
      busy.current = false;
    }
  }, [demo, key, wallet.connecting]);

  useEffect(() => {
    load();
    if (demo) return;
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load, demo]);

  return { data, reload: load };
}
