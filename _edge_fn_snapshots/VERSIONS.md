# Edge function live versions (Phase 2b Step 2 — borders)
Pulled/deployed 2026-06-15 via Supabase MCP (project zbcdeglxwrappriwpxwt).

- stripe-webhook **v21** — resolvePrintAsset now takes wantVariant; resolves
  requested variant (bordered/alt-crop) → print-master → public src. Reads
  metadata.variant. Owner email shows which variant printed.
- create-checkout-session **v20** — accepts `variant`, whitelists
  (bordered|alt-crop|print-master), passes metadata[variant]; appends
  "— white border" to the line-item name for bordered. Price unchanged.
- generate-bordered — one-shot helper (list/upslot/row/reset). Used to generate
  41 ratio-preserving white-border variants. Safe to retire.

- send-booking-emails **v2** — deployed 2026-08-10. Branding only: the client
  and owner emails now use the /book paper palette (#f6f5f2 sheet on #efeee9,
  #d8d5cd hairlines, Bebas hero, Share Tech Mono labels, DM Sans body) in a
  table layout that survives Outlook. Data, guards, idempotency and send order
  are unchanged from v1. `verify_jwt` stays OFF.
  - `send-booking-emails.v1.ts` — pre-branding snapshot, restorable as-is.
  - `send-booking-emails.v2.ts` — what is live now.
  - Previews: `_booking_build/email-preview-{client,owner,call}.html`.

⚠️ These deployed fns are the source of truth; pull via MCP get_edge_function
before any redeploy. stripe-webhook.v20.ts in this folder is the PRE-borders
snapshot (kept for diff).

## vercel-analytics — v1 deployed 2026-09-03 (`verify_jwt: true`)
Admin-only proxy for the Vercel Web Analytics API, backing the Analytics
panel in /mr.manager. Checks `public.is_site_admin()` with the caller's JWT,
then forwards a whitelisted query to api.vercel.com with `VERCEL_TOKEN`
(Supabase secret — never in the client). Returns 501 `{setup:true}` until the
secret is set. Snapshot: `vercel-analytics.v1.ts`.

## stripe-webhook — v24 deployed 2026-09-03 (`verify_jwt: false`, unchanged)
Adaptive Pricing turned on in Stripe the same day. DB `amount_total` stays USD
(written by create-checkout-session, never overwritten). v24 only appends the
USD figure from `session.currency_conversion` to the buyer/owner email totals.
Diff vs v23: `_edge_fn_snapshots/stripe-webhook.v24.patch.md`. Live check:
bad signature → 400 (verification path intact).
