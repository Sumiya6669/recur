# Handoff: где мы сейчас

Обновлено 26 сентября 2026. Откройте папку `recur` в Claude Code и скажите: «Прочитай HANDOFF.md и продолжай».
Контекст проекта — CLAUDE.md, приёмка — docs/ACCEPTANCE.md, безопасность — SECURITY.md, питч — docs/pitch.md.

## Готово
- GitHub https://github.com/Sumiya6669/recur (public), Vercel https://recur-tawny.vercel.app (push в main = деплой).
- Программа в devnet `Dtzj1BPFspDjfACbQXDZ1Hsx6CizeYRg9aa2Po1BAawA`; сборка и деплой — `.github/workflows/program.yml`
  (`gh workflow run program.yml -f deploy=true`). WSL на этой машине нет.
- Keeper: `/api/cron/charge` раз в минуту с cron-job.org; ключ keeper в Vercel; сквозная проверка `scripts/e2e-devnet.ts` проходит.
- Веб: EN/RU/KZ, `/status`, 404 и страница ошибки, `/legal`, CSP и заголовки безопасности, CI `Web`.
- Питч под критерии правил, письма мерчантам EN/RU/KZ, пример `examples/discord-gate`.
- Ключи вне репозитория: `C:\Users\1C\.recur-keys\` (program, deployer, keeper, tester).

- Лимит каждой подписки on-chain (`budget_remaining`, `extend`, ошибка 6012): 13 тестов, программа обновлена в devnet, e2e пройден.

- На телефоне без кошелька — кнопки «Открыть в Phantom / Solflare»; в devnet при нехватке USDC — ссылка на faucet.circle.com.
- Презентация на claude.ai обновлена: https://claude.ai/artifact/2EvzyJpi2UAiuYbnzNiWs2 (13 тестов, бюджеты, ссылки).

## Дальше у Claude (до mainnet, после хакатона)
- `MIN_PERIOD_SECS` через cargo-фичу devnet, конфиг mainnet, передача upgrade authority на Squads, разбор PR Dependabot, Supabase.

## Ждёт пользователя
- Phantom блокирует домен как «возможно вредоносный»: письмо на review@phantom.com (черновик дан в чате 26.09); свой домен снизит риск повторения.
  Транзакции теперь отправляет сам кошелёк (signAndSendTransaction), как советует Blowfish.
- Тест с Phantom на телефоне, вычитка казахского, оповещение cron-job.org на `/api/status`, ограничение ключа Helius по домену,
  правило WAF (по желанию), мерчанты, видео на английском, регистрация и заявка на colosseum.com
  до 12.10 23:59 PT (13.10 11:59 Алматы). Supabase — позже, по решению пользователя.

## Не делать
- Не вливать PR Dependabot #1–6 до дедлайна.
- Не деплоить в mainnet и не тратить SOL/USDC без явного согласия.
