# Pitch kit

Материалы на английском, потому что судьи Colosseum смотрят на английском. Всё в квадратных скобках заменить на ваши реальные цифры. Не выдумывайте трекшн: судьи проверяют, и честные «3 мерчанта, 41 USDC» лучше красивой неправды.

---

## One-liner

**Recur is Stripe Billing for USDC on Solana: non-custodial subscriptions that customers approve once and can cancel from any wallet.**

## 60-second pitch

Subscriptions are how the internet gets paid. But crypto can't do them: a blockchain only moves money when the owner signs, so every month a crypto business has to chase customers to pay again. Some take a year upfront, most lose revenue to people who simply forget.

Recur fixes that. A customer approves a capped amount once, from their own wallet. The subscription, its price and its schedule are recorded on Solana. When a period ends, the payment is collected automatically. The funds never sit with us or the merchant in between. Prices are locked, there's no back-billing, and anyone can cancel in one click.

For the merchant it's a checkout link, a dashboard and one API call: is this wallet paid up? That's what gates a Discord role, an API key or a private channel.

We start with crypto-native communities and tools that already charge by hand: [N] merchants are live and have collected [X] USDC during the hackathon. Next is every internet business that wants global customers without card rails, and eventually AI agents paying for services on a schedule.

## Pitch video script (≤ 3 min)

| Time | On screen | Voiceover |
|---|---|---|
| 0:00–0:15 | Landing page, live orbit ticking | "This is every subscription of a business, moving around the month. When a dot reaches now, a customer just paid. In USDC, on Solana, with no one holding their money." |
| 0:15–0:45 | Screen recording of a Discord owner's "pay me in USDC" message thread, then a calendar | "Today, crypto businesses can't charge monthly. Blockchains only move money when the owner signs, so founders chase every customer every month, or ask for a year upfront and lose most of them." |
| 0:45–1:30 | Phone: open checkout link, connect Phantom, "Subscribe and pay 10 USDC", success | "With Recur, the customer approves once, with a cap they choose, and pays the first period in the same transaction. The price and schedule live on-chain. The money stays in their wallet until each payment is due." |
| 1:30–2:05 | Dashboard: orbit, MRR, subscriber table, a new payment landing from the 2-minute plan | "The merchant sees revenue as it really behaves: what's due, what's at risk and why. One call tells them if a wallet has access. A signed webhook fires on every payment." |
| 2:05–2:30 | `/account` cancel, then Blink on X | "Customers cancel from any wallet in one click. And every plan is a Blink, so you can subscribe straight from a post." |
| 2:30–2:50 | Traction slide or tweet screenshots | "During the hackathon, [N] communities started charging through Recur and collected [X] USDC across [Y] payments." |
| 2:50–3:00 | Logo + URL | "Recur. Get paid every month in USDC." |

## Technical demo script (≤ 3 min)

1. **Architecture (30 s).** One global delegate PDA per program, because SPL Token allows a single delegate per token account. The subscription PDA `(plan, subscriber)` stores the locked amount, period, grace and `max_cycles`. `charge` is permissionless and can only move `amount` to `merchant.settlement_wallet`'s account once per period.
2. **Safety (40 s).** Show `SECURITY.md`: threat table, the tests for redirected payments, early charges, back-billing, cancel, completed plans, Token-2022 rejection. Mention the approval is recomputed from on-chain state on every subscribe/cancel, so one wallet can hold many subscriptions safely.
3. **Live run (60 s).** Terminal: `npm test` (12 passed). Then `scripts/e2e-devnet.ts` against the deployed site: Blink builds a transaction, subscribe to the 2-minute plan, the production keeper collects the renewal on schedule, cancel shrinks the approval and `/api/access` turns off. Finish on `/status`.
4. **Keeper and webhooks (30 s).** `/api/cron/charge` response, `payment.succeeded` event with HMAC signature header.
5. **Access API (20 s).** `curl /api/access?plan=…&wallet=…` → `{"active": true}`.

## Colosseum submission

**Project name:** Recur

**Short description (≤ 140 chars):** Non-custodial USDC subscriptions on Solana. Customers approve once, payments are collected on schedule, cancel from any wallet.

**Long description:**
Recur brings recurring payments to Solana. Crypto businesses can't charge monthly today because transfers need the owner's signature every time, so they chase customers by hand or take a year upfront.

With Recur, the customer approves a capped amount once and pays the first period in the same transaction. The subscription's price and schedule are recorded on-chain, and each payment is collected when due by a permissionless crank. Funds stay in the customer's wallet in between. Prices are locked at signup, there is no back-billing after a lapse, and the subscriber or merchant can cancel at any time.

Merchants get a hosted checkout, Blinks, a dashboard with MRR, forecast and at-risk payments, an access-check API and signed webhooks. The program is written in Anchor 1.2 with 12 tests, end-to-end runs on a local validator and against the live devnet deployment, and a written security review.

We start with crypto-native communities, bots and API tools that already accept USDC manually, then expand to any internet business selling globally and to AI agents that pay for services on a schedule.

**Links:**
- Live demo: https://recur-tawny.vercel.app (sample dashboard at `/dashboard?demo=1`)
- Checkout to try on devnet: https://recur-tawny.vercel.app/pay/DwBEiTu7wzZ2pSeVmw17NkYC34SWVviDEGmp6c9J2qVA
- Code: https://github.com/Sumiya6669/recur
- Program (devnet): `Dtzj1BPFspDjfACbQXDZ1Hsx6CizeYRg9aa2Po1BAawA`

**Tracks:** Solana ($100,000 across the 10 best products that integrate Solana), plus the overall ranking (Grand Champion and 20 standout teams). There is no separate payments track this season.

## Hard questions from judges

**Why won't Stripe or MoonPay just do this?**
They will serve large merchants with card-style custody. Our wedge is small crypto-native sellers who need wallet-native, non-custodial billing and access gating, which is too small a segment for them to build for first. Being open and permissionless also lets others build on the primitive.

**Isn't one global delegate dangerous?**
It's the only way to hold several subscriptions per token account under SPL Token's single-delegate rule. The program limits each subscription to its locked amount once per period, approvals are capped and recomputed exactly, and upgrade authority moves to a multisig before mainnet.

**What happens if another app overwrites the approval?**
The keeper detects it before the due date and emits `payment.at_risk`; the subscriber gets a one-click "Renew approval".

**How do you make money?**
A small fee per successful payment, free until a volume threshold so early merchants can start at zero cost. Later: analytics, trials, plan upgrades with proration, dunning.

**Is the market big enough?**
The entry market is communities and tools already paid in USDC. The larger market is stablecoin billing for internet businesses outside card rails, and scheduled payments between AI agents.

**Why Solana?**
A charge costs a fraction of a cent, which makes $3 subscriptions viable; Blinks let people subscribe from a post; USDC liquidity is deep.
