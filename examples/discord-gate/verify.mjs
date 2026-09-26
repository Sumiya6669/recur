// Proves that a Discord user controls a wallet before you link them. No dependencies; Node 20+.
//
// Ask the member to sign this exact text in their wallet (Phantom: signMessage):
//   Link Discord <user id> to Recur plan <plan address>
// and send you the base58 signature. Then:
//
//   node verify.mjs <discord user id> <wallet address> <plan address> <base58 signature>
//
// Prints "ok" and exits 0 when the signature is valid; add the pair to links.json.
import { webcrypto } from "node:crypto";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58Decode(s) {
  let n = 0n;
  for (const c of s) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("not base58");
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n % 256n)); n /= 256n; }
  for (const c of s) { if (c !== "1") break; bytes.unshift(0); }
  return Uint8Array.from(bytes);
}

export const linkMessage = (userId, plan) => `Link Discord ${userId} to Recur plan ${plan}`;

export async function verifyLink({ userId, wallet, plan, signature }) {
  const pub = base58Decode(wallet);
  const sig = base58Decode(signature);
  if (pub.length !== 32 || sig.length !== 64) return false;
  const key = await webcrypto.subtle.importKey("raw", pub, { name: "Ed25519" }, false, ["verify"]);
  return webcrypto.subtle.verify("Ed25519", key, sig, new TextEncoder().encode(linkMessage(userId, plan)));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("verify.mjs")) {
  const [userId, wallet, plan, signature] = process.argv.slice(2);
  if (!signature) {
    console.error("usage: node verify.mjs <discord user id> <wallet> <plan> <base58 signature>");
    process.exit(2);
  }
  const ok = await verifyLink({ userId, wallet, plan, signature }).catch(() => false);
  console.log(ok ? "ok" : "invalid signature");
  process.exit(ok ? 0 : 1);
}
