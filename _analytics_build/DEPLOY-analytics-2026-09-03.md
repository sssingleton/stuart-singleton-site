# Analytics panel in /mr.manager — deploy notes (2026-09-03)

## What changed in the repo (push all of it)
- `api/track.js` — NEW Vercel edge fn. Beacon endpoint: stamps geo (`x-vercel-ip-*`), classes device/bot, inserts into Supabase `site_events` with the anon key (INSERT-only RLS). No secrets.
- `index.html` — `ssTrack()` beacon (auto `page_view` on every URL change, deduped) + hooks on `openPrintModal` (buy_modal), `openRequestModal` (request_print), `addToCart`, `submitPrintOrder`/`checkoutCart` (checkout_start), `openCart`; Vercel Web Analytics script + `va()` queue; GA4 now gets a `page_view` per SPA route; admin sign-in sets `localStorage.ss_admin=1` so Stuart's browser stops counting; the **Analytics** section (CSS `.an-*`, JS `loadAnalytics()`) at the top of the right column.
- `generate-print-pages.js` — `beacon(photoId)` injected into every `/print/*` page (`page_view` + `photo_view`) and the `/prints` hub. **Regenerated** → `print/*.html` (158 pages now, was 145 — 13 photos went for-sale since 2026-07-30), `prints.html`, `print/index.json`.
- `generate-catalog.js` / `generate-sitemap.js` re-run → `catalog.json` (158), `sitemap.xml` (163 URLs), `robots.txt` (+`Disallow: /api/`).
- `_edge_fn_snapshots/vercel-analytics.v1.ts` + VERSIONS.md.

## Already live (no push needed)
- Supabase: `site_events`, `site_traffic_baseline`, RPCs `analytics_totals/daily/photos/breakdown/live`, `is_site_admin()`. Smoke-tested: anon insert 201, anon read [], anon RPC 401, bad event 400.
- Edge fn `vercel-analytics` v1 (`verify_jwt:true` + admin check). Returns 501 `{setup:true}` until the secret exists.

## Stuart's two manual steps
1. **Vercel → stuart-singleton-site → Analytics → Enable.** (Pro plan, included.) Until then `/_vercel/insights/script.js` 404s harmlessly.
2. **Vercel → Account → Tokens → create** (read-only, scope: sssingleton's projects) → **Supabase → Edge Functions → Secrets → `VERCEL_TOKEN`**. The panel's Vercel block lights up on next load.

Optional 3: GA4 history → `_analytics_build/backfill-ga4.js` (header has the 5-step service-account setup). Baseline days render in the same chart.

## Verify after push
- `curl -s -o /dev/null -w "%{http_code}" -X POST https://stuartsingleton.com/api/track -H 'Content-Type: application/json' -d '{"s":"verify00000001","e":"page_view","p":"/","d":"desktop"}'` → **204**. Then in Supabase: `select * from site_events order by ts desc limit 3` should show the row with `country` filled. Delete it.
- Open stuartsingleton.com in a **private window** (not signed into mr.manager), click into /shop, open a buy modal → rows appear in the "On the site now" list of /mr.manager within 30s.
- ⚠️ Signing into /mr.manager on a browser marks it excluded (`localStorage.ss_admin`). To test tracking from your own browser, use a private window.

## Addendum (same day) — ship-to gate, country copy, in-app-browser nudge
- `api/geo.js` — NEW; returns the visitor's country from Vercel geo headers.
- `index.html` — `SHIP_PAPER`/`SHIP_FRAMED` mirror `create-checkout-session` v27 (**keep in sync by hand**); buy modal + cart show a pre-Stripe status line (✓ ships / paper-only / not yet + Message me) and log `ship_blocked` / `ship_paper_only`; "Where we ship" modal (`openShipModal()`), linked from every "35 countries" mention; Instagram/Facebook in-app browser on iOS gets an "Open in Safari for Apple Pay →" link (`x-safari-https://…`), logged as `open_in_safari`; Analytics panel gained "Turned away by country".
- Copy: every "shipped worldwide" (JSON-LD, shop header, buy modal, cart, /p meta, print pages, hub, llms.txt) → "free shipping to 35 countries". The booking licence's "worldwide" is a legal term and stays.
- Supabase (live): event check-constraint widened; RPC `analytics_blocked(days)`.
- Regenerated `print/*`, `prints.html`, `sitemap.xml`, `robots.txt` again.

## Addendum 2 — in-app-browser bar (Apple Pay / Google Pay)
- Apple Pay cannot work inside Instagram/Facebook/Threads (WKWebView); Google Pay likewise in Android webviews. Only exit works.
- `index.html`: `#iab-bar` shows on /shop and /p for in-app browsers — iOS → `x-safari-https://…`, Android → `intent://…;package=com.android.chrome` with https fallback. Dismiss remembered per tab. Cart FAB lifts above it. Same bar injected into every `/print/*` page + hub by the generator. Clicks log `open_in_safari`.
- **Stripe dashboard (Stuart):** Settings → Payment methods → make sure **Link** is on (works inside webviews, one-tap for returning Stripe users); consider **PayPal**. Apple Pay / Google Pay stay on for real browsers.
- Corrected reading of the logs: German "visitors" were 1-request-per-IP scanners. Real human checkouts to date: 2 paid (Stuart, Bryce), 4 abandoned, all US.
