# Recur — project memory for Claude Code

Non-custodial USDC subscriptions on Solana ("Stripe Billing for USDC"). Built for the Colosseum
Crypto World's Fair hackathon, submission deadline **October 12, 2026**. Solo founder + Claude.
Talk to the user in Russian. Product UI, code, comments and pitch materials are in English.

## Status (handed over from claude.ai on Sep 26, 2026)

Done and verified:
- Anchor 1.2 program `programs/recur` — 12 LiteSVM tests pass (`npm test`).
- SDK `packages/sdk` (@solana/kit 8): instructions, decoders, flows with allowance math, keeper.
- `scripts/e2e-local.ts` passes against `solana-test-validator` (subscribe x2, keeper charges the due one, cancel shrinks approval).
- Next.js 16 app `apps/web`: landing with live orbit, dashboard (overview/subscribers/plans/developers, demo at `/dashboard?demo=1`), checkout `/pay/[plan]`, subscriber portal `/account`, API `/api/access`, `/api/cron/charge`, Blink `/api/actions/subscribe/[plan]`, `/actions.json`. `next build` passes; API smoke-tested against a local validator.
- `SECURITY.md` review, `MANUAL.md` (manual steps, Russian), `docs/pitch.md`, `docs/outreach.md`, `docs/webhooks.md`.
- Pitch deck (15 slides) lives on claude.ai as an artifact; brackets like [N] are placeholders for real traction.

Deployed (Sep 26, 2026):
- GitHub https://github.com/Sumiya6669/recur, Vercel project `recur` → https://recur-tawny.vercel.app (push to main deploys).
- Devnet program `Dtzj1BPFspDjfACbQXDZ1Hsx6CizeYRg9aa2Po1BAawA`, built and deployed by `.github/workflows/program.yml`
  (no WSL on this machine; `gh workflow run program.yml -f deploy=true`). Upgrade authority = deployer
  `CCgwNqrFFzVpow51oRsRrMBJ74K1rcPiZct1fCnEH9M1`. Keys live outside the repo in `C:\Users\1C\.recur-keys\`.
- Seeded merchant "Recur Demo Club" `DZRGMfLzFMhK9FRNjhsZuBswtoXr11RFfohAMfnkviFt`: plans Pro monthly
  `A1Q8KRPgfHixJZJMwX3sgkBCx1CK13hs9uRXZ2SpYjMf`, Weekly pass `G9awYy1eEKebZj29DYK9fYwaRvi3Ge7ayHCNe3yCm4YV`,
  Live demo every 2 minutes `DwBEiTu7wzZ2pSeVmw17NkYC34SWVviDEGmp6c9J2qVA` (checkout: `/pay/<plan>`).
- Keeper `EVp1Yv1spXGKNCuB2uxgC3MnfJZYGvkAwaD1vQCqv2Lc` runs via `/api/cron/charge` from an external cron.

Not done yet (in priority order) — see HANDOFF.md:
1. Checkout `/pay/...` with a real wallet; checklist from MANUAL.md section 7.
2. Supabase (user creates a fresh account): webhook outbox with retries, payment history for the dashboard, Discord role gating example.
3. First real merchants (docs/outreach.md), pitch video (docs/pitch.md).

## Layout

```
programs/recur/src/lib.rs   Anchor program (single file)
packages/sdk/src/           program.ts (PDAs, ix builders, discriminators) · accounts.ts (decoders, fetchers, status)
                            flows.ts (subscribe/cancel/restore/createPlan + allowance) · keeper.ts (runKeeperPass, webhooks)
apps/web/                   Next.js 16 App Router, Tailwind v4, wallet-adapter for signing, @solana/kit for everything else
apps/keeper/                long-running keeper (`npm run keeper`)
tests/recur.test.ts         LiteSVM tests (need target/deploy/recur.so)
scripts/                    seed-devnet.ts, e2e-local.ts, publish-github.sh/.ps1
```

## Commands

```bash
npm install
anchor build                 # or: cargo build-sbf --manifest-path programs/recur/Cargo.toml
npm test                     # 12 tests
npm run dev                  # web on :3000
npm run build                # web production build
npx tsc -p packages/sdk && npx tsc -p apps/keeper && (cd apps/web && npx tsc --noEmit)
node --import tsx scripts/e2e-local.ts     # needs solana-test-validator with the program preloaded
npm run seed:devnet          # env: RPC_URL, RECUR_PROGRAM_ID, APP_URL, PAYER_KEYPAIR
npm run keeper               # env: RPC_URL, KEEPER_SECRET_KEY, RECUR_PROGRAM_ID
```

## Windows

The user is on Windows (`C:\Users\1C\Desktop\recur`). Node/Next/SDK/tests work natively.
The Solana CLI and Anchor toolchain need **WSL2 (Ubuntu)**: run `anchor build/deploy` and
`solana-test-validator` there. Don't try to install Anchor natively on Windows.

## Invariants — do not break

- Account layouts are decoded by byte offset in `packages/sdk/src/accounts.ts` (MERCHANT_SIZE 113, PLAN_SIZE 146,
  SUBSCRIPTION_SIZE 233, memcmp offsets). Any change to program state structs must update these and the tests.
- Instruction discriminators are hardcoded in `program.ts` (sha256("global:<name>")[..8]). Recompute if an ix is renamed.
- Error codes: append new variants at the end of `RecurError` so existing codes (6000…6011) keep their meaning; `apps/web/lib/errors.ts` maps them.
- The program ID comes from `NEXT_PUBLIC_RECUR_PROGRAM_ID` / `RECUR_PROGRAM_ID`; the default in `program.ts` is a placeholder until `anchor keys sync`.
- Allowance is always recomputed from on-chain state (`requiredAllowance`) — never trust the current delegated_amount.
- Only classic SPL Token mints (USDC) are accepted by `create_plan` (Token-2022 rejected on purpose, see SECURITY.md).
- `NEXT_PUBLIC_*` env vars are inlined at build time — set them in Vercel before building.
- Anchor 1.x: `CpiContext::new_with_signer` takes the program **Pubkey**, not an AccountInfo.

## Design system (web)

Night-blue with USDC blue. Tokens in `apps/web/app/globals.css`: ink #071024, deep #0c1a35, raise #132548,
line #1d315c, fg #e8edf8, mute #8b9ac0, usdc #3d8bff, amber #f4b740 (at risk), coral #ff6b6b (overdue).
Type: Bricolage Grotesque (display/numerals, `.numeral`, `.display`), Geist (UI), Geist Mono only for addresses.
Signature element: `components/Orbit.tsx` — plans are rings, subscribers are dots at their next charge, "now" at top.
Avoid: uppercase eyebrow labels, middle-dot separators, identical card grids, gratuitous animation.

## Security and conduct

- Never commit keypairs or `.env*` (see .gitignore). The keeper key only pays fees.
- Ask the user before deploying to mainnet, spending SOL/USDC, publishing, or sending messages on their behalf.
- Don't invent traction numbers in pitch materials; keep bracketed placeholders until the user gives real ones.
