import { createKeyPairSignerFromBytes, getBase58Encoder } from "@solana/kit";

export function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

/** Accepts a Solana CLI keypair JSON array ("[12,34,...]") or a base58 secret key. */
export async function loadKeeperSigner(raw: string) {
  const bytes = raw.trim().startsWith("[")
    ? Uint8Array.from(JSON.parse(raw) as number[])
    : new Uint8Array(getBase58Encoder().encode(raw.trim()));
  if (bytes.length !== 64) throw new Error("KEEPER_SECRET_KEY must be a 64-byte secret key");
  return createKeyPairSignerFromBytes(bytes);
}
