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
 * WHAT each page does for a human (changed 2026-07-18, Stuart's call):
 *   - Full product landing page: photo, title, price table, about text,
 *     breadcrumbs, related prints. NO auto-redirect (Google renders JS and was
 *     at risk of treating the old location.replace as a redirect page). A
 *     prominent CTA button hands off to the proven /p?id=<id> SPA buy flow.
 *     We do NOT reimplement checkout. One source of truth for buy logic.
 *   - Also emits /prints.html: a static hub page linking every print (fixes
 *     orphan-page internal linking) with a FAQ + FAQPage schema.
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
  artwork.creator['@id'] = `${SITE}/#person`;
  artwork.creator.url = `${SITE}/`;
  artwork.dateModified = new Date().toISOString().slice(0, 10);
  return JSON.stringify(artwork);
}

function breadcrumbLd(item) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Prints', item: `${SITE}/prints` },
      { '@type': 'ListItem', position: 3, name: item.title, item: item.printPage },
    ],
  });
}

// Pick up to 3 related prints by shared tags (tie-break: same camera).
function computeRelated(items) {
  const rel = new Map();
  for (const a of items) {
    const aTags = new Set(a.tags);
    const scored = [];
    for (const b of items) {
      if (b.id === a.id) continue;
      let score = 0;
      for (const t of b.tags) if (aTags.has(t)) score++;
      if (a.camera && b.camera === a.camera) score += 0.5;
      if (score > 0) scored.push([score, b]);
    }
    scored.sort((x, y) => y[0] - x[0]);
    rel.set(a.id, scored.slice(0, 3).map(s => s[1]));
  }
  return rel;
}

function sizesTable(item) {
  if (!item.offeredSizes.length) {
    return `<p class="muted">This photo is not offered in standard sizes yet. Use the button below to request it as a print.</p>`;
  }
  const rows = item.offeredSizes.map(s =>
    `      <tr><td>${esc(s.label)}</td><td>${s.framed ? 'Framed fine art print' : 'Fine art print'}</td><td>$${s.priceUSD.toFixed(0)}</td></tr>`
  ).join('\n');
  return `<table class="sizes">
      <caption class="sr">Available print sizes and prices</caption>
      <thead><tr><th>Size</th><th>Format</th><th>Price (USD, shipping included)</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>`;
}

function aboutBlock(item) {
  const d = (item.pixelWidth && item.pixelHeight)
    ? ` The source file measures ${item.pixelWidth} by ${item.pixelHeight} pixels, so every offered size prints at 200 DPI or sharper.`
    : '';
  return `<h2>About this print</h2>
    <p>${esc(item.description)}. Produced as a giclee print on archival fine art paper. Sizes are offered only at the photo's native aspect ratio, so the image is never cropped.${d}</p>
    <p>Every print is made on demand by a professional print lab and shipped worldwide. Prices include shipping. Secure checkout via Stripe.</p>`;
}

function relatedBlock(related) {
  if (!related || !related.length) return '';
  const links = related.map(r =>
    `      <li><a href="/print/${esc(r.slug)}">${esc(r.title)}, fine art print</a></li>`
  ).join('\n');
  return `<h2>Related prints</h2>
    <ul class="related">
${links}
    </ul>`;
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
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
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
<script type="application/ld+json">${breadcrumbLd(item)}</script>

<style>
  :root { color-scheme: light; }
  body { margin:0; background:#fff; color:#1a1a1a;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    line-height:1.55; }
  .wrap { max-width:640px; margin:0 auto; padding:28px 24px 48px; }
  nav.crumbs { font-size:.82rem; color:#999; margin-bottom:18px; }
  nav.crumbs a { color:#777; text-decoration:none; }
  nav.crumbs a:hover { text-decoration:underline; }
  img.hero { max-width:100%; height:auto; border-radius:6px; display:block; margin:0 auto;
    box-shadow:0 8px 30px rgba(0,0,0,.12); }
  h1 { font-size:1.45rem; font-weight:600; margin:22px 0 4px; }
  h2 { font-size:1rem; font-weight:600; margin:26px 0 8px; }
  .price { font-size:.98rem; font-weight:600; margin:0 0 16px; }
  p { color:#555; font-size:.92rem; margin:0 0 12px; }
  p.muted { color:#888; }
  table.sizes { border-collapse:collapse; width:100%; font-size:.9rem; margin:8px 0 4px; }
  table.sizes th, table.sizes td { text-align:left; padding:7px 10px; border-bottom:1px solid #eee; }
  table.sizes th { color:#888; font-weight:500; font-size:.8rem; }
  .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
  a.cta { display:inline-block; background:#1a1a1a; color:#fff; text-decoration:none; margin:18px 0 6px;
    padding:13px 28px; border-radius:30px; font-size:.94rem; font-weight:500; }
  ul.related { padding-left:18px; font-size:.9rem; }
  ul.related li { margin:4px 0; }
  ul.related a { color:#1a1a1a; }
  footer { margin-top:34px; padding-top:16px; border-top:1px solid #eee; font-size:.82rem; color:#999; }
  footer a { color:#777; }
</style>
</head>
<body>
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W26BJP7J"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
  <main class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/prints">Prints</a> / ${esc(item.title)}</nav>
    <img class="hero" src="${esc(item.heroImage)}" alt="${esc(item.description)}">
    <h1>${esc(item.title)}, Fine Art Print</h1>
    <div class="price">${esc(priceLine(item))}, shipping included</div>
    ${sizesTable(item)}
    <a class="cta" href="${esc(spaTarget)}">View print options and buy</a>
    ${aboutBlock(item)}
    ${relatedBlock(item.related)}
    <footer>
      Photograph by <a href="/">Stuart Singleton</a>, Nashville TN ·
      <a href="/prints">All prints</a> · <a href="/shop">Shop</a>
    </footer>
  </main>
</body>
</html>`;
}

// ── /prints hub page ─────────────────────────────────────────────────────────
// Static index linking every print (fixes orphan internal linking), grouped by
// popular tags for keyword-rich H2s, with a FAQ + FAQPage JSON-LD.
const FAQ = [
  ['How are the prints made?',
   'Every print is a giclee print on archival fine art paper, produced on demand by a professional print lab and shipped worldwide. Framed options use a classic frame with the print mounted behind motheye glaze.'],
  ['How much do prints cost?',
   'Unframed fine art prints run from $29 to $115 depending on size. Framed prints are $119 for 8x12 inches and $245 for 16x24 inches. All prices are in USD and include worldwide shipping.'],
  ['Why do some photos offer fewer sizes?',
   'A size is offered only when the photo has enough resolution to print sharply at a 200 DPI floor, and only at the photo’s native aspect ratio so the image is never cropped. Larger sizes appear as full-resolution files are added.'],
  ['How do I buy a print?',
   'Open any print page and choose View print options. Checkout is handled securely by Stripe, and the order is printed and shipped by the print lab directly to you.'],
];

function faqLd() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(([q, a]) => ({
      '@type': 'Question', name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  });
}

function hubHTML(items) {
  // Group by popular tags (>=5 items); each print appears in exactly one group.
  const counts = {};
  for (const it of items) for (const t of it.tags) counts[t] = (counts[t] || 0) + 1;
  const popular = Object.keys(counts).filter(t => counts[t] >= 5)
    .sort((a, b) => counts[b] - counts[a]);
  const groups = new Map();
  const rest = [];
  for (const it of items) {
    const g = it.tags.find(t => popular.includes(t));
    if (g) { if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); }
    else rest.push(it);
  }
  if (rest.length) groups.set('More prints', rest);

  const cap = s => s.replace(/\b\w/g, c => c.toUpperCase());
  const sections = [...groups.entries()].map(([g, list]) => {
    const links = list.map(it => {
      const from = it.priceRangeUSD ? ` <span class="from">from $${Math.round(it.priceRangeUSD.min)}</span>` : '';
      return `      <li><a href="/print/${esc(it.slug)}">${esc(it.title)}</a>${from}</li>`;
    }).join('\n');
    return `  <section>
    <h2>${esc(g === 'More prints' ? g : cap(g))}</h2>
    <ul>
${links}
    </ul>
  </section>`;
  }).join('\n');

  const faqHtml = FAQ.map(([q, a]) =>
    `    <h3>${esc(q)}</h3>\n    <p>${esc(a)}</p>`).join('\n');

  const desc = `Browse all ${items.length} fine art photography prints by Stuart Singleton. Cities, landscapes, and life on the road, printed on archival paper and shipped worldwide from $29.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Y7P9FGW6PT"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-Y7P9FGW6PT');
</script>
<title>Fine Art Photography Prints | Stuart Singleton</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}/prints">
<link rel="icon" href="/favicon.ico" sizes="any">
<meta property="og:type" content="website">
<meta property="og:title" content="Fine Art Photography Prints | Stuart Singleton">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/og-shop.jpg">
<meta property="og:url" content="${SITE}/prints">
<script type="application/ld+json">${faqLd()}</script>
<style>
  body { margin:0; background:#fff; color:#1a1a1a; line-height:1.55;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; }
  .wrap { max-width:760px; margin:0 auto; padding:30px 24px 60px; }
  h1 { font-size:1.6rem; margin:0 0 6px; }
  h2 { font-size:1.05rem; margin:28px 0 6px; }
  h3 { font-size:.95rem; margin:18px 0 4px; }
  p { color:#555; font-size:.92rem; margin:0 0 12px; }
  ul { padding-left:18px; font-size:.9rem; }
  li { margin:3px 0; }
  a { color:#1a1a1a; }
  .from { color:#999; font-size:.82rem; }
  .lead a { font-weight:500; }
  footer { margin-top:38px; padding-top:16px; border-top:1px solid #eee; font-size:.82rem; color:#999; }
  footer a { color:#777; }
</style>
</head>
<body>
  <main class="wrap">
    <h1>Fine Art Photography Prints</h1>
    <p class="lead">${esc(desc)} Prefer a visual browse? Use the <a href="/shop">interactive shop</a>.</p>
${sections}
  <section>
    <h2>Print FAQ</h2>
${faqHtml}
  </section>
    <footer>
      Photographs by <a href="/">Stuart Singleton</a>, Nashville TN ·
      <a href="/shop">Shop</a> · <a href="/catalog.json">Catalog feed</a> · <a href="/llms.txt">llms.txt</a>
    </footer>
  </main>
</body>
</html>`;
}

async function main() {
  const { items } = await fetchCatalog();
  console.log(`Fetched ${items.length} for-sale photos.`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const relatedMap = computeRelated(items);
  const map = {};
  const seen = new Set();
  const wanted = new Set();
  for (const item of items) {
    if (seen.has(item.slug)) { console.warn('  ! duplicate slug (skipped):', item.slug); continue; }
    seen.add(item.slug);
    item.related = relatedMap.get(item.id) || [];
    fs.writeFileSync(path.join(OUT_DIR, `${item.slug}.html`), pageHTML(item));
    map[item.slug] = item.id;
    wanted.add(`${item.slug}.html`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(map, null, 2));
  fs.writeFileSync(path.join(__dirname, 'prints.html'), hubHTML(items));
  console.log('Wrote prints.html hub.');

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
