import { address, createSolanaRpc } from "@solana/kit";
import { USDC_MINT } from "@recur/sdk";

export const CLUSTER = (process.env.NEXT_PUBLIC_CLUSTER ?? "devnet") as "devnet" | "mainnet" | "localnet";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
export const USDC = address(process.env.NEXT_PUBLIC_USDC_MINT || (CLUSTER === "mainnet" ? USDC_MINT.mainnet : USDC_MINT.devnet));
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

let _rpc: ReturnType<typeof createSolanaRpc> | null = null;
export const rpc = () => (_rpc ??= createSolanaRpc(RPC_URL));

export const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}${CLUSTER === "mainnet" ? "" : `?cluster=${CLUSTER === "localnet" ? "custom" : CLUSTER}`}`;
export const explorerAddr = (a: string) =>
  `https://explorer.solana.com/address/${a}${CLUSTER === "mainnet" ? "" : `?cluster=${CLUSTER === "localnet" ? "custom" : CLUSTER}`}`;
