#!/usr/bin/env node
/**
 * generate-print-pages.js
 * ----------------------------------------------------------------------------
 * Builds one REAL static HTML page per for-sale photo at /print/<slug>.
 *
 * WHY static files (not just the /p?id= SPA route):
 *   - Crawlers + AI agents read the OG/Twitter meta AND schema.org JSON-LD out
 *     of the RAW HTML before any JavaScript runs. The SPA (/p?id=) is one shared
 *     index.html shell, so it cannot give a non-JS agent per-photo markup.
 *   - These static pages carry per-photo <title>, og:image, description, an
 *     <h1>, alt text, AND a VisualArtwork + Product JSON-LD block with offers,
 *     price, availability, and (when known) pixel dimensions. This is what makes
 *     the catalog quotable by AI search.
 *
 * WHAT each page does for a human:
 *   - Paints the photo + title + price-from line instantly.
 *   - Then redirects into the proven /p?id=<id> SPA buy flow. We do NOT
 *     reimplement checkout. One source of truth for buy logic.
 *
 * PRICING / SIZES come from catalog-data.js, which MIRRORS the live buy modal's
 * PRINT_SIZES + MIN_PRINT_DPI(200) + sizesForPhoto() gate. What is marked up is
 * exactly what is offered. Gate by pixels not inches. Masters stay private; only
 * measured dimensions are exposed, never the master file.
 *
 * Copy contains NO em dashes (house rule).
 *
 * Run from repo root:   node generate-print-pages.js
 * Output:               ./print/<slug>.html  +  ./print/index.json
 */

const fs = require('fs');
const path = require('path');
const { fetchCatalog, SITE } = require('./catalog-data.js');

const OUT_DIR = path.join(__dirname, 'print');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// schema.org JSON-LD: VisualArtwork wrapping a Product offer set. We use a
// single Product node with an AggregateOffer (low/high price) so agents see the
// real price range, plus the artwork metadata (artform, creator, dimensions).
function jsonLd(item) {
  const offers = item.offeredSizes.length ? {
    '@type': 'AggregateOffer',
    priceCurrency: 'USD',
    lowPrice: item.priceRangeUSD.min.toFixed(2),
    highPrice: item.priceRangeUSD.max.toFixed(2),
    offerCount: item.offeredSizes.length,
    availability: `https://schema.org/${item.availability}`,
    offers: item.offeredSizes.map(s => ({
      '@type': 'Offer',
      name: `${item.title} fine art print, ${s.label}${s.framed ? ' framed' : ''}`,
      sku: s.sku,
      price: s.priceUSD.toFixed(2),
      priceCurrency: 'USD',
      availability: `https://schema.org/${item.availability}`,
    })),
  } : undefined;

  const artwork = {
    '@context': 'https://schema.org',
    '@type': ['VisualArtwork', 'Product'],
    name: `${item.title}, fine art print`,
    description: item.description,
    image: item.ogImage,
    url: item.printPage,
    artform: 'Photograph',
    artMedium: 'Giclee fine art print',
    creator: { '@type': 'Person', name: 'Stuart Singleton' },
    creditText: 'Stuart Singleton',
    copyrightHolder: { '@type': 'Person', name: 'Stuart Singleton' },
    keywords: item.tags.join(', '),
  };
  // Only assert dimensions we actually measured (a real master or preview).
  if (item.pixelWidth && item.pixelHeight) {
    artwork.width = { '@type': 'QuantitativeValue', value: item.pixelWidth, unitCode: 'E37' };  // E37 = pixel
    artwork.height = { '@type': 'QuantitativeValue', value: item.pixelHeight, unitCode: 'E37' };
  }
  if (offers) artwork.offers = offers;
  if (item.camera) artwork.creator.knowsAbout = item.camera;
  return JSON.stringify(artwork);
}

function priceLine(item) {
  if (!item.priceRangeUSD) return 'Print options';
  const lo = Math.round(item.priceRangeUSD.min);
  return `Prints from $${lo}`;
}

function pageHTML(item) {
  const fullTitle = `${item.title}, Fine Art Print | Stuart Singleton`;
  const canonical = item.printPage;
  const spaTarget = item.pPage;
  // Description: factual, no em dashes, includes price-from when known.
  const priceBit = item.priceRangeUSD ? ` Prints from $${Math.round(item.priceRangeUSD.min)}, printed on demand and shipped worldwide.` : ' Printed on demand and shipped worldwide.';
  const desc = `${item.description}.${priceBit} Secure checkout.`.replace(/\.\./g, '.');

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

<!-- Open Graph (Pinterest / Facebook / iMessage / agents) -->
<meta property="og:type" content="product">
<meta property="og:title" content="${esc(item.title)}, Fine Art Print">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(item.ogImage)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="Stuart Singleton">
${item.priceRangeUSD ? `<meta property="product:price:amount" content="${item.priceRangeUSD.min.toFixed(2)}">
<meta property="product:price:currency" content="USD">
<meta property="og:availability" content="${item.availability === 'InStock' ? 'instock' : 'preorder'}">` : ''}

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(item.title)}, Fine Art Print">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(item.ogImage)}">

<!-- schema.org structured data: VisualArtwork + Product (offers, price, dims) -->
<script type="application/ld+json">${jsonLd(item)}</script>

<!-- Hand off to the live SPA buy flow for HUMANS, without defeating crawlers.
     We deliberately DO NOT use <meta http-equiv="refresh"> and we fire the JS
     redirect only AFTER the body paints (on load, next tick). Crawlers and AI
     agents that run no JS (or ignore JS redirects) read the full static page +
     JSON-LD below; humans get bounced into /p?id= which runs the proven
     openProductFast() checkout. -->
<script>
  // Defer so the static content is the document a crawler sees first.
  window.addEventListener('load', function () {
    setTimeout(function () { window.location.replace(${JSON.stringify(spaTarget)}); }, 120);
  });
</script>

<style>
  :root { color-scheme: light; }
  body { margin:0; background:#fff; color:#1a1a1a;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    display:flex; min-height:100vh; align-items:center; justify-content:center; }
  .wrap { max-width:520px; padding:32px 24px; text-align:center; }
  img { max-width:100%; height:auto; border-radius:6px;
    box-shadow:0 8px 30px rgba(0,0,0,.12); }
  h1 { font-size:1.15rem; font-weight:600; margin:22px 0 6px; }
  .price { color:#1a1a1a; font-size:.95rem; font-weight:600; margin:0 0 4px; }
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
    <img src="${esc(item.heroImage)}" alt="${esc(item.description)}">
    <h1>${esc(item.title)}</h1>
    <div class="price">${esc(priceLine(item))}</div>
    <p>Fine art print by Stuart Singleton. Loading print options.</p>
    <a class="cta" href="${esc(spaTarget)}">View print options</a>
  </div>
</body>
</html>`;
}

async function main() {
  const { items } = await fetchCatalog();
  console.log(`Fetched ${items.length} for-sale photos.`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const map = {};
  const seen = new Set();
  const wanted = new Set();
  for (const item of items) {
    if (seen.has(item.slug)) { console.warn('  ! duplicate slug (skipped):', item.slug); continue; }
    seen.add(item.slug);
    fs.writeFileSync(path.join(OUT_DIR, `${item.slug}.html`), pageHTML(item));
    map[item.slug] = item.id;
    wanted.add(`${item.slug}.html`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(map, null, 2));

  // Prune stale pages for photos no longer for-sale, without wiping the dir
  // (avoids EPERM on locked mounts and never leaves the site page-less mid-run).
  let pruned = 0;
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.html') && !wanted.has(f)) {
      try { fs.unlinkSync(path.join(OUT_DIR, f)); pruned++; } catch (e) { console.warn('  ! could not prune', f); }
    }
  }
  console.log(`Wrote ${Object.keys(map).length} pages to ${OUT_DIR}${pruned ? ` (pruned ${pruned} stale)` : ''}`);
}

main().catch(e => { console.error(e); process.exit(1); });
