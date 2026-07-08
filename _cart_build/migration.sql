-- Multi-photo cart migration.
-- Additive + nullable → 100% backward compatible with the current single-item
-- flow (old create-checkout-session never writes it; old stripe-webhook never
-- reads it). Safe to run on the live DB before deploying the new functions.
alter table print_orders add column if not exists items jsonb;
comment on column print_orders.items is
  'Cart line items for this order: [{photo_id, sku, frame_color, variant, copies}]. NULL for legacy single-item orders (fulfilled from Stripe metadata).';
