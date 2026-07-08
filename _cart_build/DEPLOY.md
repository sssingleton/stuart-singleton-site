# Multi-photo cart — deploy runbook

Everything here is built but **NOT deployed**. Deploy in this order so nothing
breaks mid-rollout. The whole change is backward compatible: the existing
"Buy It Now" single-item path keeps working at every step.

## What changed
- **Frontend** (`index.html`): added an "Add to Cart" button in the buy modal, a
  floating cart button, a cart drawer, and `checkoutCart()`. The old
  `submitPrintOrder()` ("Buy It Now") is untouched. Cart persists in
  `localStorage` (`sss_cart_v1`) and is cleared on the success page.
- **Edge fn `create-checkout-session` v24** (`create-checkout-session.index.ts`):
  now accepts `{ items:[...] }` OR the legacy `{ photoId, sku, ... }`. Same
  price map, same variant whitelist, same server-side size/ratio gate — applied
  per item. Writes the full list to `print_orders.items`.
- **Edge fn `stripe-webhook` v23** (`stripe-webhook.index.ts`): fulfils every
  item in `print_orders.items` as one Prodigi order with multiple lines. Falls
  back to the single item in Stripe metadata for legacy orders.
- **DB** (`migration.sql`): adds a nullable `items jsonb` column to `print_orders`.

## Deploy order (important)
1. **Run the migration** — additive, safe on live:
   `print_orders` gets a nullable `items jsonb` column.
2. **Deploy `create-checkout-session` v24** (paste `create-checkout-session.index.ts`).
   Single-item "Buy It Now" still works; it just also writes `items`.
3. **Deploy `stripe-webhook` v23** (paste `stripe-webhook.index.ts`).
   Reads `items` when present, else metadata (legacy).
4. **Push the site** (`index.html`) so the cart UI goes live.

If you push the site *before* step 2, "Buy It Now" still works but the cart's
Checkout button will error until v24 is live — so keep this order.

## Test before going fully live (Stripe TEST mode)
1. Temporarily point `STRIPE_SECRET_KEY` at your **test** key (or test in a
   Supabase branch). Use Stripe's `4242 4242 4242 4242` test card.
2. Add **2–3 different photos/sizes** to the cart → Checkout. Confirm:
   - Stripe shows all line items with correct prices + a $0 "Free shipping" rate.
   - `print_orders` row has `items` populated and `amount_total` = sum.
   - Webhook (test-mode Prodigi sandbox key) creates ONE Prodigi order with
     multiple items; owner email lists every line + which asset printed.
3. Add a **framed** item → confirm Canada is removed from the shipping countries.
4. Try a size the photo can't support → confirm it's blocked (422) — the gate
   runs per item, so a bad item blocks the whole cart with a clear message.
5. Cancel a checkout → confirm the cart is still intact (only the success page
   clears it).

Prices are unchanged from v23. Rollback = redeploy the previous function
versions; the `items` column can stay (harmless).
