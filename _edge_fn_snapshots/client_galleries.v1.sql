-- Client galleries (Shop v2 Phase 2), applied 2026-10-20 to zbcdeglxwrappriwpxwt via MCP migrations:
--   client_galleries_v1, client_gallery_clean_preview, print_orders_gallery
-- Kept here for reference; the database is the source of truth.

create table public.client_galleries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  access_code text not null check (length(access_code) >= 6),
  title text not null default 'Photo Shoot',
  client_name text, client_email text, shoot_date date,
  included_unlocks int not null default 18 check (included_unlocks >= 0),
  bonus_unlocks int not null default 0 check (bonus_unlocks >= 0),
  extra_unlock_cents int not null default 2000 check (extra_unlock_cents >= 0),
  bundle_size int not null default 5 check (bundle_size >= 2),
  bundle_cents int not null default 7500 check (bundle_cents >= 0),
  expires_at timestamptz, is_active boolean not null default false, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.client_gallery_photos (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.client_galleries(id) on delete cascade,
  position int not null default 0, filename text,
  master_path text not null, preview_path text not null, thumb_path text not null,
  clean_path text,               -- unwatermarked 1600px, only signed for the client once unlocked
  width int, height int, bytes bigint, sha256 text,
  created_at timestamptz not null default now(),
  unique (gallery_id, sha256)
);

create table public.client_gallery_orders (      -- extra-photo purchases (Stripe metadata.kind = gallery)
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.client_galleries(id) on delete cascade,
  stripe_session_id text unique, credits int not null check (credits > 0), amount_total int not null,
  currency text not null default 'usd', photo_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','paid','expired','error')),
  customer_email text, created_at timestamptz not null default now(), paid_at timestamptz
);

create table public.client_gallery_unlocks (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.client_galleries(id) on delete cascade,
  photo_id uuid not null unique references public.client_gallery_photos(id) on delete cascade,
  source text not null check (source in ('allowance','admin')),   -- admin = "Give" (free, outside allowance)
  order_id uuid references public.client_gallery_orders(id),
  created_at timestamptz not null default now()
);

-- RLS on all four; only is_site_admin() has policies. Public access is ONLY via the client-gallery edge fn.
-- client_gallery_unlock(p_gallery, p_photos, p_order): SECURITY DEFINER, advisory-locked per gallery,
--   spends allowance (included + bonus + paid credits) atomically. EXECUTE revoked from anon/authenticated.
-- Storage bucket client-galleries: private, 100MB/file, admin-only policies; paths <gallery>/{master,preview,thumb,clean}/<photo>.jpg

-- print_orders for gallery prints:
alter table public.print_orders alter column photo_id drop not null;
alter table public.print_orders add column gallery_id uuid references public.client_galleries(id) on delete set null;
alter table public.print_orders add constraint print_orders_photo_or_gallery check (photo_id is not null or gallery_id is not null);
