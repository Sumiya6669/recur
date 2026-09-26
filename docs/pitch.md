# Pitch kit

Всё на английском: по правилам хакатона (раздел 12) всё содержимое заявки должно быть на английском.
Всё в квадратных скобках замените реальными данными. Трекшн не выдумывайте: судьи проверяют, и честные
«3 мерчанта, 41 USDC» лучше красивой неправды. Логотипы Colosseum в видео и слайдах не используйте.
Всем, кто появляется в кадре, нужно согласие.

Судьи оценивают по шести критериям (раздел 8 правил): Functionality, Potential Impact, Novelty, UX,
Open-source, Business Plan. Ниже у каждого блока помечено, на какой критерий он работает.

Ссылки для всех материалов:
- Live demo: https://recur-tawny.vercel.app (sample dashboard: `/dashboard?demo=1`)
- Try a subscription on devnet: https://recur-tawny.vercel.app/pay/DwBEiTu7wzZ2pSeVmw17NkYC34SWVviDEGmp6c9J2qVA
- Code: https://github.com/Sumiya6669/recur
- Program (devnet): `Dtzj1BPFspDjfACbQXDZ1Hsx6CizeYRg9aa2Po1BAawA`
- Status: https://recur-tawny.vercel.app/status

---

## One-liner

**Recur is Stripe Billing for USDC on Solana: non-custodial subscriptions that customers approve once and can cancel from any wallet.**

## Presentation video (2–3 min, you on camera, few slides)

Судьи смотрят это видео одним из первых. Главное здесь — вы, проблема и бизнес, а не экран с кодом.
Снимайте лицом в камеру, слайды короткие, продукт — один фрагмент на 25 секунд.

| Time | On screen | Voiceover | Criterion |
|---|---|---|---|
| 0:00–0:15 | You on camera | "I'm [name]. For [N] years I've built billing and accounting systems for businesses in [Kazakhstan]: invoices, recurring charges, reconciliation. Recur is what I wish existed for stablecoins." | Business Plan (can this team execute) |
| 0:15–0:45 | Slide: a Discord "DM me 20 USDC for access" message, a calendar with reminders | "Subscriptions are how the internet gets paid, but crypto can't do them. A blockchain only moves money when the owner signs, so every month a crypto business chases every customer to pay again. Some ask for a year upfront and lose most buyers. Most just lose revenue to people who forget." | Potential Impact |
| 0:45–1:15 | Slide: one wallet, many subscriptions, one capped approval | "The insight: SPL tokens allow one delegate per token account, which is why nobody could run many subscriptions from one wallet safely. Recur uses a single program-owned delegate and enforces each subscription's price, schedule and budget on-chain. The money stays in the customer's wallet until a payment is due, and nobody, including us, can take more than they agreed to." | Novelty |
| 1:15–1:40 | Product clip: phone, Blink in a post → Subscribe → success; then the dashboard orbit | "For the customer it's one approval, from a checkout link or straight from a post. For the merchant it's a dashboard and one API call: is this wallet paid up? That gates a Discord role, an API key or a private channel." | UX |
| 1:40–2:10 | Slide with real numbers | "During the hackathon [N] communities started charging through Recur: [X] USDC across [Y] payments, [Z] active subscribers. [Short quote from a merchant]." | Business Plan, Impact |
| 2:10–2:40 | Slide: go-to-market and revenue | "We start with communities and tools that already collect USDC by hand, first in [Central Asia and the Russian-speaking crypto community], where crypto businesses have the fewest payment options. Then any internet business selling globally, and AI agents paying for services on a schedule. We take [0.5]% of each successful payment, free for the first 10 merchants." | Business Plan |
| 2:40–3:00 | You on camera, URL | "Recur is open source and composable: any app can check access or build on the program. Recur. Get paid every month in USDC." | Open-source |

## Product demo video (≤ 3 min, screen recording)

| Time | What to show | Say | Criterion |
|---|---|---|---|
| 0:00–0:40 | Phone, Phantom on devnet: open the 2-minute plan checkout, Subscribe, success screen | "One approval with a cap, first payment in the same transaction. Price and schedule are now on Solana." | UX |
| 0:40–1:05 | Dashboard: orbit, MRR, forecast, needs attention; the next payment lands from the keeper | "Two minutes later the keeper collects the next payment. Anyone can run the keeper; it can only move the agreed amount to the merchant." | Functionality |
| 1:05–1:25 | `/account` → Cancel; `/api/access` flips to `false` | "The customer cancels from any wallet. The unused approval shrinks immediately and access turns off." | UX |
| 1:25–2:05 | GitHub: `programs/recur/src/lib.rs` constraints, `SECURITY.md` threat table, CI green, 12 tests passing | "Every account is constrained; funds can only go to the merchant's settlement wallet; Token-2022 is rejected so the amount is always exact; each subscription has its own on-chain budget." | Functionality |
| 2:05–2:40 | Terminal: `scripts/e2e-devnet.ts` output; `/status` page | "This script subscribes, waits for the renewal, lets the production keeper collect it, cancels and checks access, on the live site." | Functionality |
| 2:40–3:00 | Developers page: Access API, webhooks with HMAC, Blinks; the Discord gating example | "Composable by design: an access API, signed webhooks, Blinks and a TypeScript SDK. The Discord example in the repo grants roles from on-chain state." | Open-source |

## Weekly update (≈ 1 min, recommended by Colosseum)

> Week [N] of Recur. Shipped: [2–3 things]. Learned from merchants: [one insight]. Numbers: [merchants, subscribers, USDC collected]. Next week: [one goal].

## Submission text

**Project name:** Recur

**Short description (≤ 140 chars):** Non-custodial USDC subscriptions on Solana. Customers approve once, payments are collected on schedule, cancel from any wallet.

**Blockchains and tools:** Solana (Anchor 1.2 program, SPL Token, Solana Actions/Blinks), USDC, @solana/kit, Next.js on Vercel, Helius RPC, Squads-compatible payout wallets.

**Long description:**

*Problem (Potential Impact).* Subscriptions are how the internet gets paid, yet crypto businesses can't charge monthly: every transfer needs the owner's signature, so they chase customers by hand or take a year upfront. Communities, bots, API providers and creators already paid in USDC lose revenue every month to friction and forgetfulness.

*What's new (Novelty).* SPL tokens allow one delegate per token account, so a wallet couldn't safely hold several pull-payment subscriptions. Recur uses one program-owned delegate and enforces each subscription's locked price, period, grace period and budget on-chain. The approval is recomputed from on-chain state on every subscribe and cancel. `charge` is permissionless and can only move the agreed amount to the merchant's own account, once per period. There is no custody at any point.

*Experience (UX).* The customer approves once and pays the first period in the same transaction, from a hosted checkout or directly from a post via a Blink. They can cancel from any wallet; the unused approval shrinks immediately. Merchants get a dashboard with MRR, a 30-day forecast, at-risk payments and why they're at risk, plus a public status page. The interface is available in English, Russian and Kazakh.

*Working product (Functionality).* Live on devnet with a public site, program tests, CI that builds and deploys the program, and an end-to-end script that runs against the production deployment: subscribe, automatic renewal by the production keeper, cancel, access check. A written security review covers the threat model and residual risks.

*Open and composable (Open-source).* MIT-licensed. An access API (`/api/access`), HMAC-signed webhooks, Solana Actions for every plan, a TypeScript SDK and a Discord role-gating example. Payout wallets can be Squads vaults. Anyone can run the keeper.

*Business (Business Plan).* We start with crypto-native sellers that already collect USDC by hand, beginning with [Central Asia and Russian-speaking communities], and expand to internet businesses selling globally and to AI agents paying on a schedule. Revenue: a [0.5]% fee on successful payments, free for the first 10 merchants. Traction during the hackathon: [N merchants, Y subscribers, X USDC collected]. Before mainnet: multisig upgrade authority and an external audit.

**Go-to-market and demand validation:** [how many merchants you contacted, how many replied, who went live, quotes].

**Team:** [name, location, background: years building billing and accounting systems, relevant links].

**Tracks:** Solana ($100,000 across the 10 best products that integrate Solana), plus the overall ranking (Grand Champion and 20 standout teams). Consider the Public Goods Award too: Recur is an open, permissionless payments primitive. There is no separate payments track this season.

## Hard questions from judges

**Why won't Stripe or MoonPay just do this?**
They will serve large merchants with card-style custody. Our wedge is small crypto-native sellers who need wallet-native, non-custodial billing and access gating, which is too small a segment for them to build for first. Being open and permissionless also lets others build on the primitive.

**Isn't one global delegate dangerous?**
It's the only way to hold several subscriptions per token account under SPL Token's single-delegate rule. The program limits each subscription to its locked amount once per period and to its own on-chain budget, approvals are capped and recomputed exactly, and upgrade authority moves to a multisig before mainnet.

**What happens if another app overwrites the approval?**
The keeper detects it before the due date and emits `payment.at_risk`; the subscriber gets a one-click "Renew approval".

**How do you make money?**
A small fee per successful payment, free until a volume threshold so early merchants can start at zero cost. Later: analytics, trials, plan upgrades with proration, dunning.

**Is the market big enough?**
The entry market is communities and tools already paid in USDC. The larger market is stablecoin billing for internet businesses outside card rails, and scheduled payments between AI agents.

**Why Solana?**
A charge costs a fraction of a cent, which makes $3 subscriptions viable; Blinks let people subscribe from a post; USDC liquidity is deep.

**Why you?**
[Your answer: years of building billing and accounting for real businesses; you know reconciliation, recurring invoicing and what merchants need before they trust a payment system.]
