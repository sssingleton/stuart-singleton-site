# stripe-webhook v23 → v24 (2026-09-03)

Only change: Adaptive Pricing is now ON in Stripe, so `session.currency` /
`session.amount_total` arrive in the BUYER's currency (EUR, GBP, …). The DB row
is untouched — `print_orders.amount_total` is written in USD cents by
`create-checkout-session` and the webhook never overwrites it — but the emails
built `total` from the session, so the owner subject read "41.20 EUR" with no
USD figure. v24 appends the settled USD from `session.currency_conversion`
(`amount_total` + `source_currency`) when present:

```ts
const conv = sessionObj.currency_conversion as { amount_total?: number; source_currency?: string } | undefined;
const total = money(amountTotal, currency) + (conv && conv.amount_total != null && conv.source_currency && conv.source_currency !== currency
  ? ` (${money(conv.amount_total, conv.source_currency)})` : "");
```

Buyer email keeps the same `total` (they see what they paid, plus USD in
brackets — harmless). Everything else byte-identical to v23. `verify_jwt` stays
FALSE (Stripe calls it with a signature, not a JWT).
