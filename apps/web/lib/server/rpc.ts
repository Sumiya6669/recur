import "server-only";
import { createSolanaRpc } from "@solana/kit";

export const serverRpc = () =>
  createSolanaRpc(process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com");
