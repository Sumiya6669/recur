/**
 * Recur keeper: collects due payments and emits webhook events.
 *   npm run keeper            -> loop every KEEPER_INTERVAL_SECS (default 30)
 *   npm run once -w @recur/keeper -> single pass (for cron)
 *
 * Env: RPC_URL, KEEPER_SECRET_KEY, [WEBHOOK_URL, WEBHOOK_SECRET], [KEEPER_INTERVAL_SECS], [RECUR_PROGRAM_ID]
 */
import { createSolanaRpc } from "@solana/kit";
import { consoleSink, runKeeperPass, webhookSink, type EventSink } from "@recur/sdk/keeper";
import { loadKeeperSigner, required } from "./env.ts";

const rpc = createSolanaRpc(required("RPC_URL"));
const keeper = await loadKeeperSigner(required("KEEPER_SECRET_KEY"));
const interval = Number(process.env.KEEPER_INTERVAL_SECS ?? 30) * 1000;
const once = process.argv.includes("--once");

const sinks: EventSink[] = [consoleSink];
if (process.env.WEBHOOK_URL) sinks.push(webhookSink(process.env.WEBHOOK_URL, required("WEBHOOK_SECRET")));
const sink: EventSink = async (e) => { for (const s of sinks) await s(e); };

const log = (msg: string, extra: object = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...extra }));

async function pass() {
  const started = Date.now();
  try {
    const r = await runKeeperPass({ rpc, keeper, sink });
    log("pass", {
      ms: Date.now() - started,
      checked: r.checked,
      due: r.due,
      charged: r.charged.length,
      skipped: r.skipped.length,
      errors: r.errors,
    });
  } catch (err) {
    log("pass_failed", { error: (err as Error).message });
  }
}

log("keeper_started", { keeper: keeper.address, intervalSecs: interval / 1000, once });
const { value: lamports } = await rpc.getBalance(keeper.address).send();
if (lamports < 10_000_000n) log("low_balance_warning", { lamports: lamports.toString(), hint: "fund the keeper with SOL for fees" });

await pass();
if (!once) {
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    await pass();
    running = false;
  }, interval);
}
