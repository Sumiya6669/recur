"use client";
import { address, type Base64EncodedWireTransaction, type Instruction } from "@solana/kit";
import { VersionedTransaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { compileUnsignedTransaction, confirmSignature } from "@recur/sdk";
import { rpc } from "./config";

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Compile with @solana/kit, sign with any Wallet Standard wallet, send + confirm via RPC. */
export async function signAndSend(wallet: WalletContextState, instructions: Instruction[]) {
  if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Connect a wallet first.");
  const { base64 } = await compileUnsignedTransaction(rpc(), address(wallet.publicKey.toBase58()), instructions);
  const signed = await wallet.signTransaction(VersionedTransaction.deserialize(b64ToBytes(base64)));
  const wire = bytesToB64(signed.serialize()) as Base64EncodedWireTransaction;
  const signature = await rpc().sendTransaction(wire, { encoding: "base64", preflightCommitment: "confirmed" }).send();
  await confirmSignature(rpc(), signature);
  return signature;
}
