import {
  AccountRole,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";

// ------------------------------------------------------------------ config

const envProgramId =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_RECUR_PROGRAM_ID || process.env.RECUR_PROGRAM_ID)) ||
  "";

/** Set via NEXT_PUBLIC_RECUR_PROGRAM_ID / RECUR_PROGRAM_ID after `anchor keys sync`. */
export const RECUR_PROGRAM_ID: Address = address(
  envProgramId || "Dtzj1BPFspDjfACbQXDZ1Hsx6CizeYRg9aa2Po1BAawA",
);
export const SYSTEM_PROGRAM_ID = address("11111111111111111111111111111111");
export const TOKEN_PROGRAM_ID = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const TOKEN_2022_PROGRAM_ID = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

export const USDC_MINT = {
  mainnet: address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  devnet: address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
} as const;

/** How many future payments a new approval covers when the plan has no cycle cap. */
export const DEFAULT_BUDGET_CYCLES = 12n;

export const DISCRIMINATORS = {
  initMerchant: [209, 11, 214, 195, 222, 157, 124, 192],
  updateMerchant: [192, 114, 143, 220, 199, 50, 234, 165],
  createPlan: [77, 43, 141, 254, 212, 118, 41, 186],
  setPlanActive: [215, 87, 208, 194, 87, 65, 181, 5],
  subscribe: [254, 28, 191, 138, 156, 179, 183, 53],
  charge: [26, 55, 197, 209, 93, 77, 242, 15],
  cancel: [232, 219, 223, 41, 219, 236, 220, 190],
  Merchant: [71, 235, 30, 40, 231, 21, 32, 64],
  Plan: [161, 231, 251, 119, 2, 12, 162, 2],
  Subscription: [64, 7, 26, 135, 102, 132, 98, 33],
} as const;

// ------------------------------------------------------------------ codecs

const utf8 = new TextEncoder();
const utf8d = new TextDecoder();
const addrEnc = getAddressEncoder();

export const u64le = (v: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
};
export const i64le = (v: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, v, true);
  return b;
};
export const concatBytes = (...parts: ArrayLike<number>[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

/** UTF-8 encode into a zero-padded 32-byte array without splitting a character. */
export function encodeName(name: string): Uint8Array {
  const out = new Uint8Array(32);
  let used = 0;
  for (const ch of name.trim()) {
    const b = utf8.encode(ch);
    if (used + b.length > 32) break;
    out.set(b, used);
    used += b.length;
  }
  return out;
}
export function decodeName(bytes: Uint8Array): string {
  let end = bytes.indexOf(0);
  if (end === -1) end = bytes.length;
  return utf8d.decode(bytes.subarray(0, end));
}

/** Human amount ("9.99") -> base units for a mint with `decimals`. */
export function toBaseUnits(amount: string | number, decimals = 6): bigint {
  const [whole, frac = ""] = String(amount).trim().split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}
export function fromBaseUnits(v: bigint, decimals = 6): number {
  return Number(v) / 10 ** decimals;
}

// ------------------------------------------------------------------ PDAs

export const findDelegatePda = async (programId = RECUR_PROGRAM_ID) =>
  (await getProgramDerivedAddress({ programAddress: programId, seeds: [utf8.encode("delegate")] }))[0];

export const findMerchantPda = async (authority: Address, programId = RECUR_PROGRAM_ID) =>
  (
    await getProgramDerivedAddress({
      programAddress: programId,
      seeds: [utf8.encode("merchant"), addrEnc.encode(authority)],
    })
  )[0];

export const findPlanPda = async (merchant: Address, planId: bigint, programId = RECUR_PROGRAM_ID) =>
  (
    await getProgramDerivedAddress({
      programAddress: programId,
      seeds: [utf8.encode("plan"), addrEnc.encode(merchant), u64le(planId)],
    })
  )[0];

export const findSubscriptionPda = async (plan: Address, subscriber: Address, programId = RECUR_PROGRAM_ID) =>
  (
    await getProgramDerivedAddress({
      programAddress: programId,
      seeds: [utf8.encode("subscription"), addrEnc.encode(plan), addrEnc.encode(subscriber)],
    })
  )[0];

// ------------------------------------------------------------------ instructions

const w = (a: Address) => ({ address: a, role: AccountRole.WRITABLE });
const r = (a: Address) => ({ address: a, role: AccountRole.READONLY });
const ws = (s: TransactionSigner) => ({ address: s.address, role: AccountRole.WRITABLE_SIGNER, signer: s });
const rs = (s: TransactionSigner) => ({ address: s.address, role: AccountRole.READONLY_SIGNER, signer: s });
const data = (d: readonly number[], ...args: ArrayLike<number>[]) => concatBytes(d, ...args);

export async function getInitMerchantInstruction(p: {
  authority: TransactionSigner;
  settlementWallet: Address;
  name: string;
}): Promise<Instruction> {
  return {
    programAddress: RECUR_PROGRAM_ID,
    accounts: [ws(p.authority), w(await findMerchantPda(p.authority.address)), r(SYSTEM_PROGRAM_ID)],
    data: data(DISCRIMINATORS.initMerchant, addrEnc.encode(p.settlementWallet), encodeName(p.name)),
  };
}

export async function getUpdateMerchantInstruction(p: {
  authority: TransactionSigner;
  settlementWallet: Address;
  name: string;
}): Promise<Instruction> {
  return {
    programAddress: RECUR_PROGRAM_ID,
    accounts: [rs(p.authority), w(await findMerchantPda(p.authority.address))],
    data: data(DISCRIMINATORS.updateMerchant, addrEnc.encode(p.settlementWallet), encodeName(p.name)),
  };
}

export async function getCreatePlanInstruction(p: {
  authority: TransactionSigner;
  planId: bigint;
  mint: Address;
  amount: bigint;
  periodSecs: bigint;
  graceSecs: bigint;
  name: string;
}): Promise<Instruction> {
  const merchant = await findMerchantPda(p.authority.address);
  return {
    programAddress: RECUR_PROGRAM_ID,
    accounts: [ws(p.authority), w(merchant), w(await findPlanPda(merchant, p.planId)), r(p.mint), r(SYSTEM_PROGRAM_ID)],
    data: data(
      DISCRIMINATORS.createPlan,
      u64le(p.amount),
      i64le(p.periodSecs),
      i64le(p.graceSecs),
      encodeName(p.name),
    ),
  };
}

export async function getSetPlanActiveInstruction(p: {
  authority: TransactionSigner;
  plan: Address;
  active: boolean;
}): Promise<Instruction> {
  return {
    programAddress: RECUR_PROGRAM_ID,
    accounts: [rs(p.authority), r(await findMerchantPda(p.authority.address)), w(p.plan)],
    data: data(DISCRIMINATORS.setPlanActive, [p.active ? 1 : 0]),
  };
}

export async function getSubscribeInstruction(p: {
  subscriber: TransactionSigner;
  merchant: Address;
  plan: Address;
  mint: Address;
  subscriberTokenAccount: Address;
  merchantTokenAccount: Address;
  tokenProgram: Address;
  maxCycles?: bigint;
}): Promise<Instruction> {
  return {
    programAddress: RECUR_PROGRAM_ID,
    accounts: [
      ws(p.subscriber),
      r(p.merchant),
      w(p.plan),
      w(await findSubscriptionPda(p.plan, p.subscriber.address)),
      r(p.mint),
      w(p.subscriberTokenAccount),
      w(p.merchantTokenAccount),
      r(await findDelegatePda()),
      r(p.tokenProgram),
      r(SYSTEM_PROGRAM_ID),
    ],
    data: data(DISCRIMINATORS.subscribe, u64le(p.maxCycles ?? 0n)),
  };
}

export async function getChargeInstruction(p: {
  cranker: TransactionSigner;
  merchant: Address;
  subscription: Address;
  mint: Address;
  subscriberTokenAccount: Address;
  merchantTokenAccount: Address;
  tokenProgram: Address;
}): Promise<Instruction> {
  return {
    programAddress: RECUR_PROGRAM_ID,
    accounts: [
      rs(p.cranker),
      r(p.merchant),
      w(p.subscription),
      r(p.mint),
      w(p.subscriberTokenAccount),
      w(p.merchantTokenAccount),
      r(await findDelegatePda()),
      r(p.tokenProgram),
    ],
    data: data(DISCRIMINATORS.charge),
  };
}

export function getCancelInstruction(p: {
  signer: TransactionSigner;
  merchant: Address;
  plan: Address;
  subscription: Address;
  subscriber: Address;
}): Instruction {
  return {
    programAddress: RECUR_PROGRAM_ID,
    accounts: [rs(p.signer), r(p.merchant), w(p.plan), w(p.subscription), w(p.subscriber)],
    data: data(DISCRIMINATORS.cancel),
  };
}
