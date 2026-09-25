# Webhooks

The keeper POSTs JSON to `WEBHOOK_URL` for every payment event.

| Event | When |
|---|---|
| `payment.succeeded` | A due payment was collected |
| `payment.failed` | A due payment couldn't be collected (`reason`: `delegate_missing`, `allowance_low`, `balance_low`) |
| `payment.at_risk` | The next payment (within 24 h) will fail unless the subscriber acts |
| `subscription.completed` | The last payment of a `max_cycles` subscription was collected |

```json
{
  "id": "evt_9DGKrLY1_1792966915_payment.succeeded",
  "type": "payment.succeeded",
  "created": 1790374915,
  "data": {
    "subscription": "9DGK…",
    "plan": "…",
    "merchant": "…",
    "subscriber": "…",
    "mint": "EPjF…",
    "amount": "5000000",
    "cycle": "2",
    "next_charge_at": 1792966915,
    "signature": "5h3…"
  }
}
```

Amounts are strings in base units (USDC has 6 decimals).

## Verifying

Header: `x-recur-signature: t=<unix>,v1=<hex>` where `v1 = HMAC_SHA256(WEBHOOK_SECRET, "<t>.<raw body>")`.
Reject if the timestamp is older than 5 minutes. Deduplicate on `id`; the same event can be delivered more than once.

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyRecur(body: string, header: string, secret: string) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```
