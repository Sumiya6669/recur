# Discord role gating with Recur

Give a Discord role to members whose Recur subscription is paid up, and take it away when it lapses.
The source of truth is the chain: `GET /api/access?plan=…&wallet=…`. No database, no dependencies.

## 1. Create the bot

1. https://discord.com/developers/applications → New Application → Bot → Reset Token (keep it secret).
2. OAuth2 → URL Generator: scope `bot`, permission **Manage Roles**. Open the URL and add the bot to your server.
3. In Server Settings → Roles, drag the bot's role **above** the role it will grant.
4. Enable Developer Mode in Discord, then right-click to copy the server ID and the role ID.

## 2. Link members to wallets

Each member signs one message in their wallet, which proves they control it:

```
Link Discord <their user id> to Recur plan <plan address>
```

Check the signature and add the pair to `links.json`:

```bash
node verify.mjs 123456789012345678 <wallet> <plan> <base58 signature>
```

`links.json`:

```json
{ "123456789012345678": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" }
```

## 3. Keep roles in sync

```bash
DISCORD_BOT_TOKEN=... GUILD_ID=... ROLE_ID=... RECUR_PLAN=<plan address> INTERVAL_SECS=60 node gate.mjs
```

Or run it once a minute from any scheduler with `INTERVAL_SECS=0`. Try it without a bot first:

```bash
DRY_RUN=1 RECUR_PLAN=<plan address> node gate.mjs
```

Members who miss a payment keep the role through the plan's grace period, then lose it. When they pay again, the next run gives it back.
