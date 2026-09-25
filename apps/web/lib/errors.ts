const PROGRAM_ERRORS: Record<number, string> = {
  6000: "Enter a price above zero.",
  6001: "Billing period must be at least one minute.",
  6002: "Grace period must be between 0 and 30 days.",
  6003: "This plan is paused and isn't taking new subscribers.",
  6004: "This payment isn't due yet.",
  6005: "Payments aren't authorized for this wallet.",
  6006: "The payment authorization is used up. Extend it to keep paying.",
  6007: "Not enough USDC in the wallet.",
  6008: "Only the subscriber or the merchant can cancel.",
  6010: "All scheduled payments are already collected.",
  6011: "Only USDC and other classic SPL tokens are supported.",
};

export function explain(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/User rejected|rejected the request|declined/i.test(msg)) return "You declined the request in your wallet.";
  if (msg.includes("INSUFFICIENT_BALANCE")) return "Not enough USDC in this wallet for the first payment.";
  if (msg.includes("NO_TOKEN_ACCOUNT")) return "This wallet has no USDC yet. Add USDC and try again.";
  if (msg.includes("ALREADY_SUBSCRIBED")) return "This wallet is already subscribed to this plan.";
  if (/insufficient lamports|insufficient funds for (fee|rent)|AccountNotFound|debit an account/i.test(msg))
    return "Not enough SOL for the network fee. Add a little SOL and try again.";
  const custom = msg.match(/"Custom":\s*(\d+)|custom program error: 0x([0-9a-f]+)/i);
  if (custom) {
    const code = custom[1] ? Number(custom[1]) : parseInt(custom[2], 16);
    if (PROGRAM_ERRORS[code]) return PROGRAM_ERRORS[code];
  }
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}
