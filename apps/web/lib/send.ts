"use client";
import { address, type Instruction, type Signature } from "@solana/kit";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { compileUnsignedTransaction, confirmSignature } from "@recur/sdk";
import { RPC_URL, rpc } from "./config";

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// Wallets pick the cluster for signAndSendTransaction from this endpoint's URL ("devnet" → solana:devnet).
let _connection: Connection | null = null;
const connection = () => (_connection ??= new Connection(RPC_URL, "confirmed"));

/** Below this the wallet can't pay fees and rent for our accounts; say so before the wallet shows a failed simulation. */
const MIN_FEE_LAMPORTS = 1_000_000n;

/**
 * Compile with @solana/kit and hand the transaction to the wallet's own signAndSendTransaction.
 * Wallet security scanners treat "sign here, we'll send it" requests from dApps as a drainer pattern,
 * so the wallet sends and simulates it itself; we only wait for confirmation.
 */
export async function signAndSend(wallet: WalletContextState, instructions: Instruction[]) {
  if (!wallet.publicKey || !wallet.sendTransaction) throw new Error("Connect a wallet first.");
  const payer = address(wallet.publicKey.toBase58());
  const { value: lamports } = await rpc().getBalance(payer, { commitment: "confirmed" }).send();
  if (lamports < MIN_FEE_LAMPORTS) throw new Error("NO_SOL");
  const { base64 } = await compileUnsignedTransaction(rpc(), payer, instructions);
  const tx = VersionedTransaction.deserialize(b64ToBytes(base64));
  const signature = (await wallet.sendTransaction(tx, connection(), { preflightCommitment: "confirmed" })) as Signature;
  await confirmSignature(rpc(), signature);
  return signature;
}
