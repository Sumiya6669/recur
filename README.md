# Recur

**Stripe Billing for USDC on Solana.** Non-custodial subscriptions: customers approve once from their own wallet,
payments are collected on schedule, and anyone can cancel from any wallet.

- Hosted checkout and Blinks for every plan
- Merchant dashboard: MRR, 30-day forecast, at-risk payments, subscriber table, CSV export
- Access API (`is this wallet paid up?`) and signed webhooks
- Permissionless keeper: no single point of failure

## Live on devnet

| | |
|---|---|
| Site | https://recur-tawny.vercel.app |
| Dashboard with sample data | https://recur-tawny.vercel.app/dashboard?demo=1 |
| Checkout, 0.10 USDC every 2 minutes | https://recur-tawny.vercel.app/pay/DwBEiTu7wzZ2pSeVmw17NkYC34SWVviDEGmp6c9J2qVA |
| Status (keeper, due payments) | https://recur-tawny.vercel.app/status |
| Program | [`Dtzj1BPFspDjfACbQXDZ1Hsx6CizeYRg9aa2Po1BAawA`](https://explorer.solana.com/address/Dtzj1BPFspDjfACbQXDZ1Hsx6CizeYRg9aa2Po1BAawA?cluster=devnet) |

To subscribe, switch Phantom to Solana Devnet (Settings → Developer settings) and get test USDC at
[faucet.circle.com](https://faucet.circle.com).

## How it works

```mermaid
sequenceDiagram
  participant S as Subscriber wallet
  participant P as Recur program
  participant K as Keeper (anyone)
  participant M as Merchant account
  S->>P: approve(delegate PDA, cap) + subscribe(plan)
  P->>M: first payment (transfer_checked)
  Note over P: Subscription PDA stores price, period, grace, max_cycles
  K->>P: charge() when period ends
  P->>M: exactly one period's amount
  S->>P: cancel() anytime
```

SPL Token allows one delegate per token account, so Recur uses a single program-wide delegate PDA and enforces
each subscription's limits in the program. The approval is recomputed from on-chain state on every subscribe
and cancel, so one wallet can hold many subscriptions.

Guarantees enforced on-chain: price locked at signup, at most one charge per period, no back-billing after a
lapse, funds only go to the merchant's own account, cancel by subscriber or merchant. See [SECURITY.md](SECURITY.md).

## Repository

```
programs/recur      Anchor 1.2 program
packages/sdk        TypeScript SDK (@solana/kit): instructions, accounts, flows, keeper
apps/web            Next.js 16: landing, dashboard, checkout, subscriber portal, API, Blinks
apps/keeper         Long-running keeper service
tests               LiteSVM tests (12)
scripts             devnet seeding, local and devnet end-to-end runs
docs                pitch kit, webhooks, merchant outreach
```

## Quickstart

```bash
npm install
anchor build && npm test                 # 12 passing
cp apps/web/.env.example apps/web/.env.local
npm run dev                              # http://localhost:3000, demo at /dashboard?demo=1
```

Deploying to devnet, seeding plans, running the keeper and going live on Vercel: [MANUAL.md](MANUAL.md) (in Russian).

### End-to-end against the live devnet deployment

```bash
RPC_URL=<devnet rpc> APP_URL=https://recur-tawny.vercel.app CRON_SECRET=<secret> SUBSCRIBER_KEYPAIR=<keypair with devnet USDC> PLAN=<plan address> node --import tsx scripts/e2e-devnet.ts
```

Blink builds a transaction, subscribe, `/api/access` is active, the production keeper collects the renewal,
cancel shrinks the approval and access turns off.

### End-to-end on a local validator

```bash
solana-test-validator --reset --bpf-program <PROGRAM_ID> target/deploy/recur.so
node --import tsx scripts/e2e-local.ts
```

## API

`GET /api/access?plan=<plan>&wallet=<wallet>` → `{ "active": true, "status": "active", "next_charge_at": 1761592000 }`

`GET /api/status` → keeper wallet and balance, due payments, program deployment; `503` with `problems` when
something needs attention, so it can back an uptime monitor.

Webhook events and signature verification: [docs/webhooks.md](docs/webhooks.md).

## CI

`.github/workflows/web.yml` typechecks the SDK, keeper and web app and builds the site on every push.
`.github/workflows/program.yml` builds the program with `cargo build-sbf`, runs the LiteSVM tests and, when started
by hand with `deploy`, deploys it to devnet from repository secrets.

## Roadmap

Protocol fee and cranker reward, free trials, plan upgrades with proration, subscriber reminders, Token-2022
support with extension checks, indexer-backed dashboard, external audit and multisig upgrade authority.

## License

MIT
