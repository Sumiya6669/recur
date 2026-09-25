export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <circle cx="16" cy="16" r="12" fill="none" stroke="var(--color-line)" strokeWidth="2" />
        <path d="M16 4 A12 12 0 1 1 5.6 22" fill="none" stroke="var(--color-usdc)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="16" cy="4" r="3" fill="var(--color-fg)" />
      </svg>
      <span className="display text-[22px] font-semibold tracking-tight">recur</span>
    </span>
  );
}
