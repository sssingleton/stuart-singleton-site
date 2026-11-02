-- quote_sweep_v1 (2026-11-02) — additive. Applied via MCP migration "quote_sweep_v1".
alter table public.print_products add column if not exists quote_sweep boolean not null default true;
update public.print_products set quote_sweep = false where sku in ('GLOBAL-CFPM-12X16','GLOBAL-CFPM-16X24');
alter table public.shipping_surcharges add column if not exists target_margin numeric not null default 0.34;
alter table public.shipping_surcharges add column if not exists auto boolean not null default true;
create table if not exists public.prodigi_quotes (sku text not null, country text not null, ok boolean not null default false,
  items_cents integer, shipping_cents integer, tax_cents integer, total_cents integer, cost_cents integer,
  carrier text, ships_from text, method text, error text, quoted_at timestamptz not null default now(), primary key (sku, country));
alter table public.prodigi_quotes enable row level security;
create table if not exists public.price_sweep_log (id bigserial primary key, at timestamptz not null default now(), sku text not null,
  country text not null, kind text not null, old_cents integer, new_cents integer, margin numeric, active boolean, detail text, emailed_at timestamptz);
alter table public.price_sweep_log enable row level security;
insert into public.app_job_tokens (name) values ('quote-sweep') on conflict do nothing;
-- + 9 inactive canvas rows in print_products (GLOBAL-CAN-*, GLOBAL-FRA-CAN-*), 22 canvas shipping_surcharges at target 0.45
-- cron: select cron.schedule('quote-sweep','17 * * * *', <net.http_post to /functions/v1/quote-sweep with x-job-token, body {"limit":40}>);
-- Rollback: select cron.unschedule('quote-sweep'); then delete the function. Nothing else reads these tables.
