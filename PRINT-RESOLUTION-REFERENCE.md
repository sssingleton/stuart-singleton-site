# Print-size resolution reference — stuartsingleton.com store

The single source of truth is the code (kept in sync in three places):
`MIN_PRINT_DPI = 200` and `SKU_PRINT_DIMS` in **index.html** (`sizesForPhoto`),
**catalog-data.js**, and the **create-checkout-session** edge function. This doc
is the human-readable record of what those values mean.

## The rule
A photo can be **sold + fulfilled** at a given size only if its print-master's
**long edge ≥ (print long-inches × 200 DPI)** AND the master's aspect ratio
matches the size's within **6%** (so the print is never cropped). Photos with no
registered master are gated by the known **~2048 px** web-preview long edge, which
clears only the small sizes below.

## Minimum master resolution per size (at 200 DPI)

| Print size    | Ratio | Min master px (long × short) | ≈ MP   | Sells off ~2048px web file? | Retail |
|---------------|-------|------------------------------|--------|-----------------------------|--------|
| 4×6           | 3:2   | 1200 × 800                   | 1.0 MP | yes                         | $29    |
| 6×9           | 3:2   | 1800 × 1200                  | 2.2 MP | yes                         | $35    |
| 6×8           | 4:3   | 1600 × 1200                  | 1.9 MP | yes                         | $29    |
| 8×12          | 3:2   | 2400 × 1600                  | 3.8 MP | no — needs master           | $45    |
| 9×12          | 4:3   | 2400 × 1800                  | 4.3 MP | no — needs master           | $45    |
| 12×16         | 4:3   | 3200 × 2400                  | 7.7 MP | no — needs master           | $59    |
| 16×24         | 3:2   | 4800 × 3200                  | 15.4 MP| no — needs master           | $79    |
| 24×36         | 3:2   | 7200 × 4800                  | 34.6 MP| no — needs master           | $115   |
| 8×12 framed   | 3:2   | 2400 × 1600                  | 3.8 MP | no — needs master           | $119   |
| 16×24 framed  | 3:2   | 4800 × 3200                  | 15.4 MP| no — needs master           | $245   |

## What clears what
- **Fuji X-T5** (40 MP, 7728 × 5152): clears **every** size, incl. 24×36.
- **Nomo masters** (~4032 px long): clear up to **8×12** (incl. framed 8×12); **not** 16×24 (needs 4800 px).
- **No-master photos** (~2048 px web file): capped at **6×9** (3:2) / **6×8** (4:3).

## Store status (as of 2026-07-08)
- **139** photos for sale. **79** have a print-master; **60** do not (capped to the small sizes above).
- Every offered size is always fulfillable — the checkout gate blocks any size the
  photo's master can't satisfy, so no un-fulfillable order can be placed.
- To unlock the larger, higher-margin sizes on the 60, register a print-master for
  each (admin → Manage Photos in `/mr.manager`). As masters are added, sizes unlock
  automatically — no code change needed.
