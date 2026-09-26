import { getSubscriptionStatus, hasAccess, type PlanAccount, type SubscriptionStatus } from "@recur/sdk";
import type { Sub } from "./demo";
import { monthly } from "./format";

export type Row = Sub & { status: SubscriptionStatus; planName: string; atRisk: boolean };

const WINDOW = 30n * 86_400n;

export function computeMetrics(plans: PlanAccount[], subs: Sub[], now: bigint) {
  const planName = new Map(plans.map((p) => [p.address, p.name]));
  const rows: Row[] = subs.map((s) => {
    const status = getSubscriptionStatus(s, now);
    const soon = s.nextChargeAt - now < 3n * 86_400n;
    const atRisk = status === "past_due" || ((status === "active") && soon && s.health !== "ok");
    return { ...s, status, planName: planName.get(s.plan) ?? "Plan", atRisk };
  });

  let mrr = 0, forecast = 0, collected = 0;
  let active = 0, pastDue = 0, lapsed = 0, atRisk = 0;
  const byPlan = new Map<string, { active: number; mrr: number }>();
  for (const r of rows) {
    collected += (Number(r.amount) / 1e6) * Number(r.cyclesPaid);
    if (r.status === "lapsed") { lapsed++; continue; }
    if (r.status === "past_due") pastDue++;
    if (r.atRisk) atRisk++;
    if (hasAccess(r, now)) {
      active++;
      const m = monthly(r.amount, r.periodSecs);
      mrr += m;
      const bp = byPlan.get(r.plan) ?? { active: 0, mrr: 0 };
      bp.active++; bp.mrr += m;
      byPlan.set(r.plan, bp);
    }
    if (r.status === "completed") continue;
    if (r.nextChargeAt <= now + WINDOW) {
      let n = 1n + (now + WINDOW - (r.nextChargeAt < now ? now : r.nextChargeAt)) / r.periodSecs;
      if (r.maxCycles > 0n) n = n < r.maxCycles - r.cyclesPaid ? n : r.maxCycles - r.cyclesPaid;
      forecast += (Number(r.amount) / 1e6) * Number(n);
    }
  }
  const upcoming = rows
    .filter((r) => r.status !== "lapsed" && r.status !== "completed" && r.nextChargeAt >= now && r.nextChargeAt <= now + 7n * 86_400n)
    .sort((a, b) => Number(a.nextChargeAt - b.nextChargeAt));

  return { rows, mrr, forecast, collected, active, pastDue, lapsed, atRisk, byPlan, upcoming };
}
