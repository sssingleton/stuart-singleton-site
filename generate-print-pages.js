#!/usr/bin/env node
/**
 * generate-print-pages.js
 * ────────────────────────────────────────────────────────────────────────────
 * Builds one REAL static HTML page per for-sale photo at /print/<slug>.
 *
 * WHY static files (not just the /p?id= SPA route):
 *   - Pinterest, Etsy, iMessage, Facebook, Google read the OG/Twitter meta tags
 *     out of the RAW HTML before any JavaScript runs. The SPA can't give a crawler
 *     a per-photo preview image/title because index.html is one shared shell.
 *   - These static pages carry per-photo <title>, og:image, og:description so a
 *     shared link shows the actual photo + a real title. That's the whole point.
 *
 * WHAT each page does for a human:
 *   - Paints the photo + title + "View print options" instantly (no SPA boot).
 *   - Then redirects into the proven /p?id=<id> SPA route, which runs the exact
 *     same openProductFast() buy flow that's already live. We do NOT reimplement
 *     checkout — we hand off to it. One source of truth for the buy logic.
 *
 * SLUG: built from the photo's place/subject tags + id suffix, e.g.
 *   /print/versailles-night-france-14   (id suffix => zero collision risk)
 *
 * Run from the repo root:   node generate-print-pages.js
 * Output:                   ./print/<slug>.html   (one per for-sale photo)
 *                           ./print/index.json     (slug<->id map, for debugging)
 *
 * No npm install needed — uses the Supabase REST endpoint over plain fetch
 * (Node 18+ has global fetch).
 */

const fs = require('fs');
const path = require('path');

// ── Config (same project + anon key the site uses) ──────────────────────────
const SUPA_URL = 'https://zbcdeglxwrappriwpxwt.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiY2RlZ2x4d3JhcHByaXdweHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzcyODUsImV4cCI6MjA4OTUxMzI4NX0.IMGxd2IIRvVWgA441aLFtH2VujrZgVRehv2Hb2qNEus';
const SITE = 'https://stuartsingleton.com';
const OUT_DIR = path.join(__dirname, 'print');

// Tags that are descriptors, not places/subjects — kept OUT of the slug so the
// URL reads like a place name, not a filter list.
const SKIP_TAGS = new Set([
  'color', 'black & white', 'b&w', 'day', 'night', 'outdoor', 'indoor',
  'interior', 'exterior', 'dramatic', 'travel', 'nature', 'architecture',
  'city', 'street', 'landscape', 'portrait',
]);

// ── helpers ─────────────────────────────────────────────────────────────────
function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Turn the comma tag string into a readable slug stem. Prefer place/subject
// tags; fall back to whatever's there; always cap length, always end with -id.
function slugForPhoto(photo) {
  const raw = (photo.tags || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  const meaningful = raw.filter(t => !SKIP_TAGS.has(t.toLowerCase()));
  const pick = (meaningful.length ? meaningful : raw).slice(0, 3);
  let stem = slugify(pick.join('-'));
  if (!stem) stem = 'print'; // photos with empty tags still get a valid slug
  // Hard cap so URLs stay sane.
  if (stem.length > 60) stem = stem.slice(0, 60).replace(/-+$/g, '');
  return `${stem}-${photo.id}`;
}

// Supabase render-image resized URL (same transform thumbURL() uses on-site).
function renderURL(src, width, quality) {
  if (!src || typeof src !== 'string') return src;
  const marker = '/storage/v1/object/public/';
  const i = src.indexOf(marker);
  if (i === -1) return src;
  const rest = src.slice(i + marker.length);
  const q = quality != null ? quality : 80;
  return src.slice(0, i) + '/storage/v1/render/image/public/' + rest +
    `?width=${width}&quality=${q}&resize=contain`;
}

function titleForPhoto(photo) {
  const raw = (photo.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  const meaningful = raw.filter(t => !SKIP_TAGS.has(t.toLowerCase()));
  const parts = (meaningful.length ? meaningful : raw).slice(0, 3);
  if (!parts.length) return 'Fine Art Print';
  // Title-case each tag.
  return parts
    .map(p => p.replace(/\b\w/g, c => c.toUpperCase()))
    .join(' · ');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── page template ───────────────────────────────────────────────────────────
function pageHTML(photo, slug) {
  const title = titleForPhoto(photo);
  const fullTitle = `${title} — Fine Art Print | Stuart Singleton`;
  const ogImg = renderURL(photo.src, 1200, 80);
  const heroImg = renderURL(photo.src, 1000, 82);
  const canonical = `${SITE}/print/${slug}`;
  const spaTarget = `${SITE}/p?id=${photo.id}`;
  const desc = `${title} — available as a museum-quality fine art print, printed on demand and shipped worldwide. Secure checkout. Photographed by Stuart Singleton.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-W26BJP7J');</script>
<!-- End Google Tag Manager -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Y7P9FGW6PT"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-Y7P9FGW6PT');
</script>
<title>${esc(fullTitle)}</title>
<link rel="canonical" href="${esc(canonical)}">
<meta name="description" content="${esc(desc)}">

<!-- Open Graph (Pinterest / Facebook / iMessage) -->
<meta property="og:type" content="product">
<meta property="og:title" content="${esc(title)} — Fine Art Print">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImg)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="Stuart Singleton">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)} — Fine Art Print">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImg)}">

<!-- Hand off to the live SPA buy flow as soon as JS runs. The static shell
     below is what crawlers + the first paint see; humans get redirected into
     /p?id= which runs the proven openProductFast() checkout. -->
<script>window.location.replace(${JSON.stringify(spaTarget)});</script>
<meta http-equiv="refresh" content="0; url=${esc(spaTarget)}">

<style>
  :root { color-scheme: light; }
  body { margin:0; background:#fff; color:#1a1a1a;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    display:flex; min-height:100vh; align-items:center; justify-content:center; }
  .wrap { max-width:520px; padding:32px 24px; text-align:center; }
  img { max-width:100%; height:auto; border-radius:6px;
    box-shadow:0 8px 30px rgba(0,0,0,.12); }
  h1 { font-size:1.15rem; font-weight:600; margin:22px 0 6px; }
  p { color:#777; font-size:.9rem; margin:0 0 18px; }
  a.cta { display:inline-block; background:#1a1a1a; color:#fff; text-decoration:none;
    padding:12px 26px; border-radius:30px; font-size:.92rem; font-weight:500; }
</style>
</head>
<body>
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W26BJP7J"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
  <div class="wrap">
    <img src="${esc(heroImg)}" alt="${esc(title)} — fine art print by Stuart Singleton">
    <h1>${esc(title)}</h1>
    <p>Loading print options…</p>
    <a class="cta" href="${esc(spaTarget)}">View print options</a>
  </div>
</body>
</html>`;
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const url = `${SUPA_URL}/rest/v1/photos?select=id,tags,camera,src,mockup_url` +
    `&for_sale=eq.true&hidden=eq.false&order=id`;
  const res = await fetch(url, {
    headers: { apikey: SUPA_KEY, authorization: `Bearer ${SUPA_KEY}` },
  });
  if (!res.ok) {
    console.error('Supabase fetch failed:', res.status, await res.text());
    process.exit(1);
  }
  const photos = await res.json();
  console.log(`Fetched ${photos.length} for-sale photos.`);

  // Fresh output dir so removed/unlisted photos don't leave stale pages behind.
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const map = {};
  const seen = new Set();
  for (const photo of photos) {
    const slug = slugForPhoto(photo); // id suffix guarantees uniqueness
    if (seen.has(slug)) { console.warn('  ! duplicate slug (skipped):', slug); continue; }
    seen.add(slug);
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), pageHTML(photo, slug));
    map[slug] = photo.id;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(map, null, 2));
  console.log(`Wrote ${Object.keys(map).length} pages to ${OUT_DIR}`);
  console.log('Sample:', Object.keys(map).slice(0, 5).map(s => `/print/${s}`).join('\n        '));
}

main().catch(e => { console.error(e); process.exit(1); });
