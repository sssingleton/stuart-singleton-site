# Deploy — framed SKU fix + per-frame-colour wall mockups (2026-06-14)

## What changed (1 file: `index.html`, +124/-1) + 1 edge function + DB

### 1. Framed SKUs / sizes / pricing corrected
- Framed product switched to the **verified Prodigi SKU `GLOBAL-CFPM-MOTH-[size]`**
  (Classic Frame, EMA 200gsm, Mounted/Matted, Motheye glaze, snow-white mount) —
  the same product confirmed during the Etsy "You Are Okay" launch.
- **Added 8×12 framed** (was 16×24-only). Now two framed sizes:
  - `GLOBAL-CFPM-MOTH-8X12` → **$119** (item cost ~$45 + ~$25 frame ship)
  - `GLOBAL-CFPM-MOTH-16X24` → **$245** (item cost ~$116 + ~$26 frame ship)
- Framed retail now **matches Etsy** ($119 / $245) so the channels don't undercut
  each other. (Old site price was $209 at 16×24 — too thin, and below Etsy.)
- Frame colour (Black / White / Natural) is a real option on this Prodigi frame
  and is passed through to fulfillment in Stripe metadata + the order row.
- 4:3 (CampSnap) photos still have **no framed option** — Prodigi's verified
  framed family is 3:2 only for now; revisit if a 4:3 frame is confirmed.

### 2. Per-frame-colour wall mockups (the Gemini room shots)
- New admin **"mockups"** button next to "versions" on each for-sale photo.
  Upload one wall shot per frame colour (black / white / natural). Optional.
- When a buyer picks a framed size + that colour, the buy modal shows the real
  wall shot instead of the CSS frame preview. Colours with no image fall back
  to the standard frame preview automatically.
- Storage: public **`photo-mockups`** bucket (RLS: public read, authenticated
  write/update/delete — same pattern as other buckets; must be logged in to upload).
- DB: `photos` gained `mockup_url`, `mockup_frame_black`, `mockup_frame_white`,
  `mockup_frame_natural` (all nullable text).

## Already deployed by Claude (live now, no action needed)
- ✅ `create-checkout-session` edge fn → **v19** (new MOTH SKUs + correct prices;
  old CFPM SKUs kept as legacy safety). `verify_jwt` stays false.
- ✅ DB columns added; `photo-mockups` bucket + RLS policies created.
- ✅ `stripe-webhook` passes SKU through with no allowlist, so the new framed
  SKUs fulfill automatically (no webhook change needed).

## What STUART must do
1. **Push the site** from the MBP:
   ```
   cd ~/Downloads/AI\ Projects/stuart-singleton-site
   git add index.html
   git commit -m "Framed SKU fix (GLOBAL-CFPM-MOTH) + 8x12 framed + per-colour wall mockups"
   git push
   ```
   (Vercel auto-deploys.)
2. **Verify** in Incognito after deploy: open a 3:2 photo's Buy modal → confirm
   **two** framed options (8×12 $119, 16×24 $245); pick framed → frame-colour
   buttons appear.
3. **Add the Gemini mockups**: log into the admin (must be authenticated for
   upload to work) → "mockups" on a for-sale photo → upload your room shots per
   colour → pick a framed size + colour in the Buy modal to see it swap in.

## Verify file integrity
- `index.html` md5 = `48d26d8b7a50211120fa1578b63fc3ed` (3570 lines)
- Working copy `StuartSingleton.com/index.html` and clone are md5-identical.
- JS syntax validated (`node --check`, clean).
