# Security review: Recur program, SDK, keeper and web app

Scope: `programs/recur/src/lib.rs` (Anchor 1.2), `packages/sdk`, `apps/keeper`, `apps/web` API routes.
Method: manual review against the Solana program vulnerability classes (missing signer/owner checks, account
substitution, PDA spoofing, arithmetic, CPI authority misuse, reinitialization, closing) plus OWASP-style review
of the HTTP surface. Backed by 12 LiteSVM tests and an end-to-end run on `solana-test-validator`.

## Summary

The program enforces the core promise: a subscriber's funds can only move to the merchant's own token account,
in the exact amount they agreed to, no more than once per period, and only while the subscription exists.
No critical issues were found. Three medium items were fixed during review; the remaining items are
operational requirements before mainnet.

## Critical issues

None found.

## Fixed during review

| # | Area | Issue | Fix |
|---|------|-------|-----|
| 1 | Program `create_plan` | Token-2022 mints can carry transfer fees, transfer hooks or a permanent delegate, breaking the "exact amount" guarantee or bricking charges | Only classic SPL Token mints are accepted (`UnsupportedMint`), covered by a test |
| 2 | `/api/access` | Uncached public endpoint lets anyone burn the RPC quota | `s-maxage=15, stale-while-revalidate=30` edge caching |
| 3 | `/api/cron/charge` | Bearer secret compared with `!==` | Constant-time comparison |
| 4 | Checkout `?redirect=` | Button labelled with the merchant name could point to a phishing site | Only `https:` URLs, and the button shows the destination host |

## Threat model and how each threat is handled

| Threat | Mitigation in code |
|---|---|
| Charge an account that never subscribed | `Subscription` is a PDA of `(plan, subscriber)` created only by `subscribe`, which requires the subscriber's signature. `charge` re-derives the PDA with the stored bump; Anchor checks owner and discriminator |
| Redirect a payment to an attacker's token account | `merchant_token_account` must have `authority == merchant.settlement_wallet` and the plan's mint (`ConstraintTokenOwner` test) |
| Charge a different token account than the one consented | `has_one = subscriber_token_account` on the subscription |
| Charge more than agreed | Amount is copied into the subscription at signup; there is no instruction that changes it. Plans have no price update |
| Charge more often than agreed | `now >= next_charge_at`, and `next_charge_at` always moves forward by one period |
| Back-billing after a lapse | Beyond the grace period the schedule restarts from `now`; exactly one period is charged (test) |
| Charge after cancel | `cancel` closes the account; later `charge` fails with `AccountNotInitialized` (test) |
| Charge beyond the agreed number of payments | `max_cycles` check, `SubscriptionCompleted` (test) |
| Third party cancels someone's subscription | Only the subscriber or the merchant authority (`Unauthorized` test) |
| Arithmetic overflow | `checked_add` everywhere, `overflow-checks = true` in release |
| Merchant changes payout wallet | Allowed by design (e.g. move to a multisig). Only affects where the merchant's own revenue goes |

## Residual risks and required actions before mainnet

| # | Risk | Action |
|---|------|--------|
| 1 | Shared delegate: a bug in the program would put every user's remaining approval at risk | Program upgrade authority on a Squads multisig; external audit; cap approvals per wallet during beta |
| 2 | Another dApp's `approve` replaces Recur's delegate and silently stops payments | Keeper emits `payment.at_risk` before the due date; `/account` offers "Renew approval" |
| 3 | A merchant cancelling does not shrink the subscriber's approval | Bounded (usable only by that wallet's other Recur subscriptions); "Renew approval" recomputes the exact amount |
| 4 | Keeper scans all subscriptions with `getProgramAccounts` | Fine for thousands; move to an indexer (Helius webhooks into Supabase) before scale |
| 5 | Webhook dedupe is in-memory | Receivers must be idempotent on `event.id`; persistent outbox arrives with Supabase |
| 6 | Keeper key is a hot wallet | It can only pay fees and trigger due charges; keep a small SOL balance and rotate if leaked |

## What looks good

- Every account is constrained by `has_one`, seeds or token constraints; no unchecked accounts except the data-less delegate PDA and the rent-refund recipient (both constrained).
- The only CPI is `transfer_checked` signed by the delegate PDA, so decimals and mint are verified by the token program.
- Permissionless `charge` removes the operator as a single point of failure without widening what can be charged.

## Verdict

Approve for devnet and a capped mainnet beta. Mainnet GA requires items 1 and 4 above.
