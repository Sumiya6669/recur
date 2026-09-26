// Keeps a Discord role in sync with Recur subscriptions. No dependencies; Node 20+.
//
//   DISCORD_BOT_TOKEN=... GUILD_ID=... ROLE_ID=... RECUR_PLAN=<plan address> node gate.mjs
//
// Env:
//   RECUR_API      default https://recur-tawny.vercel.app
//   LINKS_FILE     default ./links.json, an object { "<discord user id>": "<wallet address>" }
//                  (collect it with a signed message, see verify.mjs)
//   INTERVAL_SECS  0 = run once (for cron), otherwise loop every N seconds
//   DRY_RUN=1      only print what would change; no Discord calls, no token needed
import { readFileSync } from "node:fs";

const env = (k, d) => process.env[k] ?? d ?? (() => { throw new Error(`${k} is not set`); })();
const DRY = process.env.DRY_RUN === "1";
const API = env("RECUR_API", "https://recur-tawny.vercel.app").replace(/\/$/, "");
const PLAN = env("RECUR_PLAN");
const LINKS = env("LINKS_FILE", "./links.json");
const INTERVAL = Number(env("INTERVAL_SECS", "0"));
const DISCORD = "https://discord.com/api/v10";
const [TOKEN, GUILD, ROLE] = DRY ? ["", "", ""] : [env("DISCORD_BOT_TOKEN"), env("GUILD_ID"), env("ROLE_ID")];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function discord(method, path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${DISCORD}${path}`, { method, headers: { authorization: `Bot ${TOKEN}` } });
    if (res.status === 429) {
      const { retry_after = 1 } = await res.json().catch(() => ({}));
      await sleep(Math.ceil(retry_after * 1000) + 100);
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Discord ${method} ${path}: ${res.status} ${await res.text()}`);
    return res.status === 204 ? {} : res.json();
  }
  throw new Error(`Discord ${method} ${path}: still rate limited`);
}

async function hasAccess(wallet) {
  const res = await fetch(`${API}/api/access?plan=${PLAN}&wallet=${wallet}`);
  if (!res.ok) throw new Error(`Recur /api/access: ${res.status}`);
  return (await res.json()).active === true;
}

async function syncOnce() {
  const links = JSON.parse(readFileSync(LINKS, "utf8"));
  let granted = 0, revoked = 0, unchanged = 0;
  for (const [userId, wallet] of Object.entries(links)) {
    try {
      const active = await hasAccess(wallet);
      if (DRY) { console.log(`${userId} ${wallet}: ${active ? "should have" : "should not have"} the role`); continue; }
      const member = await discord("GET", `/guilds/${GUILD}/members/${userId}`);
      if (!member) { console.log(`${userId}: not in the server, skipped`); continue; }
      const has = member.roles.includes(ROLE);
      if (active && !has) { await discord("PUT", `/guilds/${GUILD}/members/${userId}/roles/${ROLE}`); granted++; }
      else if (!active && has) { await discord("DELETE", `/guilds/${GUILD}/members/${userId}/roles/${ROLE}`); revoked++; }
      else unchanged++;
    } catch (e) {
      console.error(`${userId}: ${e.message}`);
    }
  }
  if (!DRY) console.log(`${new Date().toISOString()} granted ${granted}, revoked ${revoked}, unchanged ${unchanged}`);
}

do {
  await syncOnce();
  if (INTERVAL > 0) await sleep(INTERVAL * 1000);
} while (INTERVAL > 0);
