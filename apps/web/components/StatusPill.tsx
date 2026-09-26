"use client";
import type { SubscriptionStatus } from "@recur/sdk";
import { useT } from "@/lib/i18n/client";

const CLS: Record<SubscriptionStatus, string> = {
  active: "text-usdc-soft bg-usdc/12 ring-usdc/30",
  past_due: "text-amber bg-amber/10 ring-amber/30",
  lapsed: "text-coral bg-coral/10 ring-coral/30",
  completed: "text-mute bg-mute/10 ring-mute/30",
};

export function StatusPill({ status }: { status: SubscriptionStatus }) {
  const { t } = useT();
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1 ring-inset ${CLS[status]}`}>{t.status[status]}</span>;
}
