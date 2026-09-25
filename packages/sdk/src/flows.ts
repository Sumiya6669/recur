import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type Rpc,
  type Signature,
  type SolanaRpcApiMainnet,
  type TransactionSigner,
} from "@solana/kit";
import {
  findAssociatedTokenPda,
  getApproveInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
  getRevokeInstruction,
} from "@solana-program/token";
import {
  decodeTokenAccount,
  fetchMaybeAccountBytes,
  fetchSubscriptionsBySubscriber,
  isCompleted,
  type MerchantAccount,
  type PlanAccount,
  type SubscriptionAccount,
} from "./accounts.ts";
import {
  DEFAULT_BUDGET_CYCLES,
  findDelegatePda,
  findMerchantPda,
  getCancelInstruction,
  getCreatePlanInstruction,
  getSubscribeInstruction,
} from "./program.ts";

type AnyRpc = Rpc<SolanaRpcApiMainnet>;
const min = (a: bigint, b: bigint) => (a < b ? a : b);

// ------------------------------------------------------------------ allowance math

/** Future payments an approval should cover for an existing subscription. */
export function budgetCycles(s: Pick<SubscriptionAccount, "maxCycles" | "cyclesPaid">) {
  if (isCompleted(s)) return 0n;
  return s.maxCycles === 0n ? DEFAULT_BUDGET_CYCLES : min(s.maxCycles - s.cyclesPaid, DEFAULT_BUDGET_CYCLES);
}

/**
 * SPL Token has a single delegate per token account, shared by every Recur subscription on it.
 * The approval must therefore cover the sum of all of them. We recompute it from on-chain
 * state every time instead of trusting the current `delegated_amount`.
 */
export function requiredAllowance(
  subs: SubscriptionAccount[],
  tokenAccount: Address,
  opts: { exclude?: Address; add?: { amount: bigint; maxCycles: bigint } } = {},
) {
  let total = 0n;
  for (const s of subs) {
    if (s.subscriberTokenAccount !== tokenAccount || s.address === opts.exclude) continue;
    total += s.amount * budgetCycles(s);
  }
  if (opts.add) {
    // first payment happens immediately inside `subscribe`, then the future budget
    const cycles =
      opts.add.maxCycles === 0n ? 1n + DEFAULT_BUDGET_CYCLES : min(opts.add.maxCycles, 1n + DEFAULT_BUDGET_CYCLES);
    total += opts.add.amount * cycles;
  }
  return total;
}

async function allowanceInstruction(p: {
  owner: TransactionSigner;
  tokenAccount: Address;
  tokenProgram: Address;
  amount: bigint;
}): Promise<Instruction> {
  if (p.amount === 0n) {
    return getRevokeInstruction({ source: p.tokenAccount, owner: p.owner }, { programAddress: p.tokenProgram });
  }
  return getApproveInstruction(
    { source: p.tokenAccount, delegate: await findDelegatePda(), owner: p.owner, amount: p.amount },
    { programAddress: p.tokenProgram },
  );
}

async function tokenProgramOf(rpc: AnyRpc, mint: Address) {
  const acc = await fetchMaybeAccountBytes(rpc, mint);
  if (!acc) throw new Error(`Mint ${mint} not found`);
  return acc.owner;
}

const ata = async (owner: Address, mint: Address, tokenProgram: Address) =>
  (await findAssociatedTokenPda({ owner, mint, tokenProgram }))[0];

// ------------------------------------------------------------------ flows

export async function buildSubscribeInstructions(p: {
  rpc: AnyRpc;
  subscriber: TransactionSigner;
  plan: PlanAccount;
  merchant: MerchantAccount;
  maxCycles?: bigint;
}) {
  const tokenProgram = await tokenProgramOf(p.rpc, p.plan.mint);
  const subscriberAta = await ata(p.subscriber.address, p.plan.mint, tokenProgram);
  const merchantAta = await ata(p.merchant.settlementWallet, p.plan.mint, tokenProgram);

  const tokenAcc = await fetchMaybeAccountBytes(p.rpc, subscriberAta);
  if (!tokenAcc) throw new Error("NO_TOKEN_ACCOUNT");
  const balance = decodeTokenAccount(tokenAcc.data).amount;
  if (balance < p.plan.amount) throw new Error("INSUFFICIENT_BALANCE");

  const existing = await fetchSubscriptionsBySubscriber(p.rpc, p.subscriber.address);
  if (existing.some((s) => s.plan === p.plan.address)) throw new Error("ALREADY_SUBSCRIBED");

  const maxCycles = p.maxCycles ?? 0n;
  const allowance = requiredAllowance(existing, subscriberAta, { add: { amount: p.plan.amount, maxCycles } });

  const instructions: Instruction[] = [
    getCreateAssociatedTokenIdempotentInstruction({
      payer: p.subscriber,
      ata: merchantAta,
      owner: p.merchant.settlementWallet,
      mint: p.plan.mint,
      tokenProgram,
    }),
    await allowanceInstruction({ owner: p.subscriber, tokenAccount: subscriberAta, tokenProgram, amount: allowance }),
    await getSubscribeInstruction({
      subscriber: p.subscriber,
      merchant: p.merchant.address,
      plan: p.plan.address,
      mint: p.plan.mint,
      subscriberTokenAccount: subscriberAta,
      merchantTokenAccount: merchantAta,
      tokenProgram,
      maxCycles,
    }),
  ];
  return { instructions, allowance, subscriberAta, merchantAta };
}

/** Cancel as the subscriber: closes the subscription and shrinks (or revokes) the approval. */
export async function buildCancelInstructions(p: { rpc: AnyRpc; subscriber: TransactionSigner; subscription: SubscriptionAccount }) {
  const tokenProgram = await tokenProgramOf(p.rpc, p.subscription.mint);
  const all = await fetchSubscriptionsBySubscriber(p.rpc, p.subscriber.address);
  const allowance = requiredAllowance(all, p.subscription.subscriberTokenAccount, { exclude: p.subscription.address });
  return [
    getCancelInstruction({
      signer: p.subscriber,
      merchant: p.subscription.merchant,
      plan: p.subscription.plan,
      subscription: p.subscription.address,
      subscriber: p.subscriber.address,
    }),
    await allowanceInstruction({
      owner: p.subscriber,
      tokenAccount: p.subscription.subscriberTokenAccount,
      tokenProgram,
      amount: allowance,
    }),
  ];
}

/** Re-approve after another app overwrote the delegate, or to extend an exhausted approval. */
export async function buildRestoreInstructions(p: { rpc: AnyRpc; subscriber: TransactionSigner }) {
  const all = await fetchSubscriptionsBySubscriber(p.rpc, p.subscriber.address);
  const byTokenAccount = new Map<Address, SubscriptionAccount[]>();
  for (const s of all) byTokenAccount.set(s.subscriberTokenAccount, [...(byTokenAccount.get(s.subscriberTokenAccount) ?? []), s]);
  const ixs: Instruction[] = [];
  for (const [tokenAccount, subs] of byTokenAccount) {
    const tokenProgram = await tokenProgramOf(p.rpc, subs[0].mint);
    ixs.push(
      await allowanceInstruction({
        owner: p.subscriber,
        tokenAccount,
        tokenProgram,
        amount: requiredAllowance(subs, tokenAccount),
      }),
    );
  }
  return ixs;
}

export async function buildCreatePlanInstructions(p: {
  rpc: AnyRpc;
  authority: TransactionSigner;
  merchant: MerchantAccount;
  mint: Address;
  amount: bigint;
  periodSecs: bigint;
  graceSecs: bigint;
  name: string;
}) {
  const tokenProgram = await tokenProgramOf(p.rpc, p.mint);
  return [
    getCreateAssociatedTokenIdempotentInstruction({
      payer: p.authority,
      ata: await ata(p.merchant.settlementWallet, p.mint, tokenProgram),
      owner: p.merchant.settlementWallet,
      mint: p.mint,
      tokenProgram,
    }),
    await getCreatePlanInstruction({
      authority: p.authority,
      planId: p.merchant.planCount,
      mint: p.mint,
      amount: p.amount,
      periodSecs: p.periodSecs,
      graceSecs: p.graceSecs,
      name: p.name,
    }),
  ];
}

export { findMerchantPda };

// ------------------------------------------------------------------ transactions

/** Unsigned transaction for a browser wallet or a Solana Action (Blink). */
export async function compileUnsignedTransaction(rpc: AnyRpc, feePayer: Address, instructions: Instruction[]) {
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  return {
    base64: getBase64EncodedWireTransaction(compileTransaction(message)),
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
  };
}

export const noopSigner = (a: Address) => createNoopSigner(a);

export async function confirmSignature(rpc: AnyRpc, signature: Signature, timeoutMs = 45_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await rpc.getSignatureStatuses([signature]).send();
    const st = value[0];
    if (st?.err) throw new Error(`Transaction failed: ${JSON.stringify(st.err, (_, v) => (typeof v === "bigint" ? String(v) : v))}`);
    if (st && (st.confirmationStatus === "confirmed" || st.confirmationStatus === "finalized")) return;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error("Transaction confirmation timed out");
}

/** Server-side: sign with a local signer, send with preflight, wait for confirmation. */
export async function sendAndConfirm(rpc: AnyRpc, feePayer: TransactionSigner, instructions: Instruction[]) {
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const tx = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(tx);
  await rpc
    .sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", preflightCommitment: "confirmed" })
    .send();
  await confirmSignature(rpc, signature);
  return signature;
}
