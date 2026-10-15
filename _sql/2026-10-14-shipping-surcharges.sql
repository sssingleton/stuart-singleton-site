-- 2026-10-14 Ship-to picker: per-country framed shipping fees + PH/IN paper free shipping.
-- Additive only. Paste into Supabase SQL editor (project zbcdeglxwrappriwpxwt) and Run.
create table if not exists public.shipping_surcharges (
  country text not null check (country ~ '^[A-Z]{2}$'),
  sku text not null,
  fee_cents integer not null check (fee_cents >= 0),
  quoted_cost_cents integer,
  quoted_at date,
  note text,
  primary key (country, sku)
);
comment on table public.shipping_surcharges is 'Per-country, per-SKU extra shipping charged when a SKU does not ship free to that country. Read by create-checkout-session (enforced) and index.html (display). Fees restore ~34% margin, rounded up to $5, from live Prodigi Standard quotes.';
alter table public.shipping_surcharges enable row level security;
drop policy if exists "public read surcharges" on public.shipping_surcharges;
create policy "public read surcharges" on public.shipping_surcharges for select to anon, authenticated using (true);
insert into public.shipping_surcharges (country, sku, fee_cents, quoted_cost_cents, quoted_at, note) values
 ('CA','GLOBAL-CFPM-MOTH-8X12',1000,7900,'2026-10-14','DHL Express from US'),
 ('CA','GLOBAL-CFPM-MOTH-16X24',3000,17100,'2026-10-14','DHL Express from US'),
 ('AU','GLOBAL-CFPM-MOTH-8X12',3500,9500,'2026-10-14','DHL Express from US'),
 ('AU','GLOBAL-CFPM-MOTH-16X24',5500,18850,'2026-10-14','DHL Express from US'),
 ('NZ','GLOBAL-CFPM-MOTH-8X12',3500,9500,'2026-10-14','DHL Express from US'),
 ('NZ','GLOBAL-CFPM-MOTH-16X24',5500,18850,'2026-10-14','DHL Express from US'),
 ('JP','GLOBAL-CFPM-MOTH-8X12',2500,8750,'2026-10-14','DHL Express from US'),
 ('JP','GLOBAL-CFPM-MOTH-16X24',3000,17100,'2026-10-14','DHL Express from US'),
 ('IS','GLOBAL-CFPM-MOTH-8X12',3000,9250,'2026-10-14','DHL Express from US'),
 ('IS','GLOBAL-CFPM-MOTH-16X24',7500,20100,'2026-10-14','DHL Express from US'),
 ('PH','GLOBAL-CFPM-MOTH-8X12',5000,10369,'2026-10-14','DHL Express from GB'),
 ('PH','GLOBAL-CFPM-MOTH-16X24',8500,20518,'2026-10-14','DHL Express from GB'),
 ('IN','GLOBAL-CFPM-MOTH-8X12',3000,9250,'2026-10-14','DHL Express from US'),
 ('IN','GLOBAL-CFPM-MOTH-16X24',7000,19655,'2026-10-14','FedEx Intl Economy from GB')
on conflict (country, sku) do update set fee_cents=excluded.fee_cents, quoted_cost_cents=excluded.quoted_cost_cents, quoted_at=excluded.quoted_at, note=excluded.note;
update public.print_products
   set countries = countries || array['PH','IN'], updated_at = now()
 where family = 'paper' and not ('PH' = any(countries));
select (select count(*) from public.shipping_surcharges) as fees, (select count(*) from public.print_products where 'PH' = any(countries)) as ph_rows;
