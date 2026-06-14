# Phase 2b — Steps 2 & 3 build spec (borders + alt-crop)

**Written 2026-06-14 by Cowork after completing Step 1.** Run these from the studio
machine (clone lives here, Cowork can't push). Ship Step 2, push, eyeball, THEN Step 3.

## Where things stand (Step 1 DONE)
- **29 for-sale native-full-res photos promoted to private `photos-masters`** + `print-master`
  rows inserted (`is_print_default=true`). 0 failures. Signed-URL fetch verified byte-identical
  to source (photo 143, SHA-256 match). 41 `print-master` rows total now (12 prior + 29).
- Dashboard "no master" badge clears for these 29 automatically (it reads `photo_assets`).
- Remaining ~61 web-opt 2048px for-sale photos still need real Lightroom re-exports via the
  live manage-versions panel (your ongoing manual backfill — Step 1 did NOT touch those).
- Two one-shot fns `promote-masters` / `promote-masters-verify` are RETIRED (return 410, JWT-gated).

## The one architectural fact that drives both steps
`stripe-webhook` v20 resolves the print asset by **photoId only** — `resolvePrintAsset(supabase, photoId, publicSrc)`
queries `photo_assets` for `variant='print-master'`. It has NO idea whether the buyer wanted a
border or the full-frame crop. So **both features require threading a variant selector from the
buy modal → checkout metadata → webhook**, and teaching `resolvePrintAsset` to honor it.

Order data flow today (don't break it):
`openPrintModal(photoId)` → user picks `_printSku` (+ `_printFrameColor`) → `create-checkout-session`
gets `{photoId, sku, frameColor, copies}` → Stripe `metadata` → webhook reads `metadata.photo_id/sku/frame_color/copies`.

**Add ONE field — `metadata.variant`** (`'print-master' | 'bordered' | 'alt-crop'`, default `'print-master'`).
Plumb it through all three layers. That single field powers both Step 2 and Step 3.

---

## STEP 2 — Bordered variant (GENERATE PROGRAMMATICALLY)

Decision (resolved): generate white borders server-side from the master, not hand-made Canva files.
Border raises effective DPI (smaller printed image area) — a bonus on lower-res files.

### 2.1 Generation — new edge fn `generate-bordered` (Anthropic-pattern: service-role, one job)
- Input `{ photoId }`. Find the photo's `print-master` row (the 24h-signed source).
- Download master → composite onto white using **ImageScript or sharp-equivalent in Deno**
  (Deno has no native Pillow; use `jsr:@imagemagick/magick-wasm` or `npm:sharp` via the
  edge runtime, OR — simpler — do generation in the Cowork sandbox with Pillow and upload via
  the manage-versions panel as a `bordered` variant. **Recommend: Pillow in sandbox** = least
  runtime risk, you already trust that path).
- **Border spec:** pure white `#FFFFFF`, width = **4% of long edge** on all sides
  (e.g. 7728px long edge → ~309px border). Re-encode ONCE at JPG quality 100, sRGB.
- Store as `photo_assets` row: `variant='bordered'`, bucket `photos-masters` (private — it's a
  print asset), path `<photoId>/bordered_<ts>.jpg`, real dims (master + 2×border), `is_print_default=false`.
- **Ratio note:** adding an equal border on all sides PRESERVES aspect ratio → the existing
  `sizesForPhoto` ratio gate still matches, so no new size family needed. ✅ (4% each side keeps ratio.)

### 2.2 Buy modal — add a paper-style toggle
- In `openPrintModal`, after size selection, add a 2-option control: **"Full bleed"** (default,
  variant `print-master`) vs **"White border"** (variant `bordered`). Only show "White border"
  if a `bordered` variant exists for that photo (query on modal open, same as dashboard does).
- Set a new module var `_printVariant = 'print-master'` (reset in `openPrintModal`), flip it on toggle.
- Buyer preview: when "White border" is active, show the bordered preview image (you can render a
  CSS white frame on the preview cheaply, or point the preview `<img>` at a signed bordered URL).

### 2.3 Checkout + webhook
- `createCheckoutSession` fetch body: add `variant: _printVariant`.
- `create-checkout-session` (v18, **diverged in MCP — pull source first**): pass `variant` into
  Stripe `metadata.variant`. Price is UNCHANGED (same paper SKU/size; border is free, it's just
  which asset prints). Keep SKU logic exactly as-is.
- `stripe-webhook` (v20, snapshot saved at `_edge_fn_snapshots/stripe-webhook.v20.ts`):
  - Read `const variant = metadata.variant || 'print-master';`
  - Change `resolvePrintAsset(supabase, photoId, publicSrc)` →
    `resolvePrintAsset(supabase, photoId, publicSrc, variant)`. Inside: query
    `.eq('variant', variant)` first; if no row, fall back to `print-master`, then public src.
    (Keeps the never-throw contract.)
  - `sizing: 'fillPrintArea'` stays — ratio gate already guarantees no crop, and the bordered
    asset keeps the same ratio, so the white border prints as intended.
  - Owner email: show which variant printed.

---

## STEP 3 — Alt-crop = SECOND BUYABLE OPTION

Decision (resolved): the full-frame original (before Instagram's ~4:5 top/bottom trim) is its own
selectable product on the same listing — the COMPLETE image, a different ratio than the cropped one.

### 3.1 Confirm the real ratio FIRST (blocking)
- Instagram-cropped verticals are ~4:5 (0.8) portrait-limited; Fuji X-T5 native is **2:3 (0.667)**.
- So alt-crop verticals are taller (2:3). **`PRINT_SIZES` already has a 3:2 family** (4×6…24×36)
  — and `sizesForPhoto` keys off ratio with `RATIO_TOLERANCE=0.06`. A 2:3 portrait = ratio 1.5
  in long/short terms → **already covered**. ✅ Verify a couple of actual alt-crop files measure
  ~1.5 long/short before relying on this. If any are 4:5/5:4, they'd need a new family (unlikely).

### 3.2 Asset
- Upload the full-frame master as `variant='alt-crop'`, private bucket, via the manage-versions
  panel (the panel already supports arbitrary variant rows — confirm the variant picker offers
  'alt-crop'; if it only lists master/preview, add the two deferred options to that `<select>`).

### 3.3 Buy modal — crop selector
- Add a control **"Instagram crop" vs "Full frame"** shown only if an `alt-crop` variant exists.
- Selecting "Full frame" sets `_printVariant='alt-crop'` AND recomputes the size menu from the
  alt-crop's OWN ratio (call `sizesForPhoto(altLongPx, altRatio)`), because it's a different shape
  than the cropped listing. Store alt-crop dims so the modal knows its ratio + resolution.
- Webhook: same `variant` plumbing as Step 2 already handles it — `resolvePrintAsset` queries
  `.eq('variant','alt-crop')`. No extra webhook change beyond Step 2's.

### 3.4 Edge
- A photo could have master + bordered + alt-crop. The buy modal then offers: crop (IG/full) ×
  border (bleed/white). Keep it simple — if that's too many combos, gate border to the IG crop
  first and add bordered-alt-crop later.

---

## Push checklist (per step)
1. Edit `~/Downloads/AI Projects/stuart-singleton-site/index.html` (LIVE source).
2. `node --check` the inline JS (extract or eyeball balance).
3. Keep `~/Downloads/AI Projects/StuartSingleton.com/index.html` md5-identical (they've drifted).
4. For edge fns: **pull current source via MCP `get_edge_function` first** (create-checkout-session
   v18 + stripe-webhook v20 are diverged-in-MCP), edit, redeploy, `deno check`.
5. Commit + push from clone → GitHub → Vercel. Cache-busted curl to confirm live.
6. One real test order per step (border order; then full-frame order) — final proof.

## Deferred after 2b
- Phase 3 (batch upload), Phase 4 (bulk + AI-assisted tagging via Anthropic edge fn).
- `photos.src` stays dual-model (no migration).
