# Что сделать руками

Всё остальное уже сделано и проверено: программа (13 тестов), SDK, keeper, веб-приложение и API прошли проверку на локальном валидаторе Solana. Здесь только шаги, которые требуют ваших ключей, аккаунтов или денег. Идите сверху вниз.

## 1. Инструменты (один раз, ~20 минут)

- [ ] Node.js 20+ и Rust (`curl https://sh.rustup.rs -sSf | sh`)
- [ ] Solana CLI: `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`
- [ ] Anchor 1.2 через avm, инструкция на anchor-lang.com/docs/installation, затем `avm install 1.2.0 && avm use 1.2.0`
- [ ] Кошелёк для деплоя: `solana-keygen new` и `solana config set --url devnet`
- [ ] SOL на devnet: `solana airdrop 2` (или faucet.solana.com), на деплой нужно около 2 SOL

## 2. Свой program ID и деплой на devnet

```bash
npm install
anchor keys sync          # новый program ID в lib.rs и Anchor.toml
anchor build
npm test                  # должно быть 13 passed
anchor deploy --provider.cluster devnet
```

- [ ] Скопируйте program ID из вывода `anchor keys list`, он понадобится в шагах 4 и 5

## 3. RPC

Публичный `api.devnet.solana.com` режет `getProgramAccounts`, на котором работают дашборд и keeper.

- [ ] Бесплатный ключ Helius (dashboard.helius.dev), URL вида `https://devnet.helius-rpc.com/?api-key=...`

## 4. Демо-данные

```bash
RPC_URL=<helius url> RECUR_PROGRAM_ID=<program id> APP_URL=<адрес сайта из шага 5> \
MERCHANT_NAME="Recur Demo Club" npm run seed:devnet
```

- [ ] Скрипт создаст мерчанта и три тарифа, включая «каждые 2 минуты» для живого демо, и напечатает ссылки на оплату
- [ ] Для тестового подписчика: Phantom → Settings → Developer → Testnet mode (Solana Devnet), затем тестовые USDC на faucet.circle.com (сеть Solana Devnet) и немного SOL на комиссии

## 5. Веб на Vercel

Этот шаг я могу сделать сам через ваш коннектор Vercel, если разрешите. Вручную:

- [ ] Залить репозиторий на GitHub (публичный, судьи смотрят код)
- [ ] Vercel → Add New Project → импорт репозитория, Root Directory: `apps/web`
- [ ] Переменные окружения (до первой сборки, `NEXT_PUBLIC_*` вшиваются при сборке):

| Переменная | Значение |
|---|---|
| `NEXT_PUBLIC_RPC_URL` | Helius URL |
| `NEXT_PUBLIC_CLUSTER` | `devnet` |
| `NEXT_PUBLIC_RECUR_PROGRAM_ID` | program ID |
| `NEXT_PUBLIC_USDC_MINT` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| `NEXT_PUBLIC_APP_URL` | `https://<ваш-проект>.vercel.app` |
| `RPC_URL` | Helius URL |
| `KEEPER_SECRET_KEY` | содержимое `keeper.json` (шаг 6) |
| `CRON_SECRET` | случайная строка, `openssl rand -hex 32` |
| `WEBHOOK_URL`, `WEBHOOK_SECRET` | по желанию, куда слать события |

## 6. Keeper (автоматические списания)

- [ ] `solana-keygen new -o keeper.json --no-bip39-passphrase` и перевести на него 0.5 SOL (этот ключ платит только комиссии)
- [ ] Вариант А, бесплатный: cron-job.org → новая задача раз в минуту, `GET https://<сайт>/api/cron/charge`, заголовок `Authorization: Bearer <CRON_SECRET>`
- [ ] Вариант Б: `npm run keeper` на Railway или Render с переменными `RPC_URL`, `KEEPER_SECRET_KEY`, `RECUR_PROGRAM_ID`

Встроенный cron Vercel на бесплатном тарифе запускается раз в сутки, для демо это не подходит.

## 7. Проверка перед показом

- [ ] `/dashboard?demo=1` открывается и выглядит как задумано (пришлите скриншот, если что-то не так)
- [ ] С телефона: открыть ссылку на тариф «каждые 2 минуты», подписаться из Phantom
- [ ] Через 2–3 минуты в дашборде видно второе списание, в `/account` следующий платёж
- [ ] `/api/access?plan=...&wallet=...` отвечает `"active": true`
- [ ] Отмена из `/account` работает, разрешение уменьшается
- [ ] Blink: вставить ссылку на тариф в dial.to и увидеть кнопку подписки

Если что-то из этого падает, не записывайте видео, а пришлите мне ошибку.

## 8. Хакатон

- [ ] Разговоры с мерчантами по шаблону из `docs/outreach.md`, цель 3–5 реальных подписок до 12 октября
- [ ] Публичный билд в X: пост с орбитой и ссылкой на демо
- [ ] Питч-видео и техническое демо по сценарию из `docs/pitch.md`
- [ ] Сабмит на colosseum.com с текстом из `docs/pitch.md`

## Перед mainnet (после хакатона)

- [ ] Передать upgrade authority программы на мультисиг Squads
- [ ] Внешний аудит, лимит суммы разрешения на время беты
- [ ] Индексатор событий вместо `getProgramAccounts` (Supabase + Helius webhooks)

## Когда откатываться

Если после деплоя keeper возвращает ошибки на каждом проходе, дашборд не видит подписок или списания уходят не тому мерчанту, остановите cron и пришлите мне лог `/api/cron/charge`.
