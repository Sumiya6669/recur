"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MerchantAccount, PlanAccount } from "@recur/sdk";
import { useMerchantData, type MerchantData } from "@/lib/useMerchantData";
import { computeMetrics } from "@/lib/metrics";
import { nowSecs } from "@/lib/format";
import type { Sub } from "@/lib/demo";

type Ready = { merchant: MerchantAccount; plans: PlanAccount[]; subs: Sub[]; metrics: ReturnType<typeof computeMetrics>; now: bigint };
type Ctx = { data: MerchantData; reload: () => Promise<void> | void; demo: boolean; ready: Ready | null; href: (p: string) => string };
const DashboardCtx = createContext<Ctx | null>(null);

export function DashboardProvider({ demo, children }: { demo: boolean; children: ReactNode }) {
  const { data, reload } = useMerchantData(demo);
  const [now, setNow] = useState(nowSecs());
  useEffect(() => { const t = setInterval(() => setNow(nowSecs()), 15_000); return () => clearInterval(t); }, []);
  const ready = useMemo<Ready | null>(() => {
    if (data.state !== "ready") return null;
    return { merchant: data.merchant, plans: data.plans, subs: data.subs, now, metrics: computeMetrics(data.plans, data.subs, now) };
  }, [data, now]);
  const href = (p: string) => (demo ? `${p}?demo=1` : p);
  return <DashboardCtx.Provider value={{ data, reload, demo, ready, href }}>{children}</DashboardCtx.Provider>;
}

export const useDashboard = () => {
  const c = useContext(DashboardCtx);
  if (!c) throw new Error("useDashboard outside provider");
  return c;
};
