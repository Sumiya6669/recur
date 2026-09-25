import type { PaymentHealth, SubscriptionStatus } from "@recur/sdk";

const STATUS: Record<SubscriptionStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "text-usdc-soft bg-usdc/12 ring-usdc/30" },
  past_due: { label: "Past due", cls: "text-amber bg-amber/10 ring-amber/30" },
  lapsed: { label: "Lapsed", cls: "text-coral bg-coral/10 ring-coral/30" },
  completed: { label: "Completed", cls: "text-mute bg-mute/10 ring-mute/30" },
};
export const HEALTH_LABEL: Record<PaymentHealth, string> = {
  ok: "Ready to charge",
  delegate_missing: "Authorization removed",
  allowance_low: "Authorization used up",
  balance_low: "Low balance",
};

export function StatusPill({ status }: { status: SubscriptionStatus }) {
  const s = STATUS[status];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
}
