#!/usr/bin/env node
/**
 * generate-sitemap.js
 * ────────────────────────────────────────────────────────────────────────────
 * Builds sitemap.xml (+ robots.txt) for stuartsingleton.com so Google can
 * discover every indexable page — the homepage, the shop, and all per-photo
 * /print/<slug> pages.
 *
 * Reads print/index.json (the slug<->id map written by generate-print-pages.js)
 * — it does NOT hit Supabase or regenerate any print pages, so it's safe to run
 * any time. Run AFTER generate-print-pages.js so the print list is current:
 *
 *   node generate-print-pages.js && node generate-sitemap.js
 *
 * Output:  ./sitemap.xml   ./robots.txt   (repo root, served at site root)
 *
 * Excluded on purpose: /p (SPA buy route, dupes the print pages), /mr.manager
 * (admin), /print-success, /whoami (utility routes). Only canonical, public,
 * indexable URLs belong in a sitemap.
 */

const fs = require('fs');
const path = require('path');

const SITE = 'https://stuartsingleton.com';
const today = new Date().toISOString().slice(0, 10);

// Top-level public routes worth indexing (priority is a hint, not a ranking).
const topRoutes = [
  { loc: `${SITE}/`,       priority: '1.0', changefreq: 'weekly'  },
  { loc: `${SITE}/shop`,   priority: '0.9', changefreq: 'weekly'  },
  { loc: `${SITE}/photos`, priority: '0.8', changefreq: 'weekly'  },
];

// Per-photo print pages from the slug map.
const mapPath = path.join(__dirname, 'print', 'index.json');
let printSlugs = [];
try {
  printSlugs = Object.keys(JSON.parse(fs.readFileSync(mapPath, 'utf8')));
} catch (e) {
  console.warn('Could not read print/index.json — sitemap will omit print pages.', e.message);
}
const printRoutes = printSlugs.map(slug => ({
  loc: `${SITE}/print/${slug}`, priority: '0.8', changefreq: 'monthly',
}));

const all = [...topRoutes, ...printRoutes];

const urlXml = all.map(r =>
  `  <url>\n    <loc>${r.loc}</loc>\n    <lastmod>${today}</lastmod>\n` +
  `    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`
).join('\n');

const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlXml}\n</urlset>\n`;

fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap);

// NOTE (2026-07-17): never emit `Disallow: /p` — robots rules are PREFIX
// matches, so it blocked /print/*, /photos, and /p (all 132 product pages
// uncrawlable). This template previously clobbered the cf37e75 robots fix on
// every regen. Keep the explicit Allows in sync with the cf37e75 intent.
const robots =
  `User-agent: *\n` +
  `Allow: /\n` +
  `Allow: /shop\n` +
  `Allow: /photos\n` +
  `Allow: /p\n` +
  `Allow: /print/\n` +
  `Allow: /catalog.json\n` +
  `Allow: /llms.txt\n` +
  `Disallow: /mr.manager\n\n` +
  `Sitemap: ${SITE}/sitemap.xml\n`;

fs.writeFileSync(path.join(__dirname, 'robots.txt'), robots);

console.log(`Wrote sitemap.xml with ${all.length} URLs (${printRoutes.length} print pages) and robots.txt`);
