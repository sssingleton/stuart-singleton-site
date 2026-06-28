#!/usr/bin/env node
/**
 * catalog-data.js
 * ----------------------------------------------------------------------------
 * Single source of truth for agent-discoverability builds. Fetches the same
 * for-sale photos the shop renders, resolves each photo's largest available
 * version (print-master if registered, otherwise the largest preview/bordered
 * asset), and computes the EXACT sizes + prices the live buy modal would offer
 * using the same PRINT_SIZES table, MIN_PRINT_DPI floor, and sizesForPhoto()
 * gate that index.html uses.
 *
 * Pricing logic is MIRRORED here, never changed. If index.html changes its
 * PRINT_SIZES or DPI floor, update the constants below to match.
 *
 * Consumed by:
 *   - generate-print-pages.js   -> static /print/<slug>.html (JSON-LD + OG + price)
 *   - generate-catalog.js       -> /catalog.json feed
 *
 * Gate by PIXELS not inches (v22 lesson): a size is offered only if the photo's
 * long edge has >= longIn * MIN_PRINT_DPI pixels. Never exposes a size the
 * server-side checkout gate would reject.
 *
 * No npm install needed (Node 18+ global fetch).
 */

const SUPA_URL = 'https://zbcdeglxwrappriwpxwt.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiY2RlZ2x4d3JhcHByaXdweHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzcyODUsImV4cCI6MjA4OTUxMzI4NX0.IMGxd2IIRvVWgA441aLFtH2VujrZgVRehv2Hb2qNEus';
const SITE = 'https://stuartsingleton.com';

// ---- MIRRORED FROM index.html (do not diverge) -----------------------------
const PRINT_SIZES = [
  { sku: 'GLOBAL-FAP-4X6',         label: '4x6"',         price: 2900,  framed: false, shortIn: 4,  longIn: 6,  ratio: 1.5 },
  { sku: 'GLOBAL-FAP-6X9',         label: '6x9"',         price: 3500,  framed: false, shortIn: 6,  longIn: 9,  ratio: 1.5 },
  { sku: 'GLOBAL-FAP-8X12',        label: '8x12"',        price: 4500,  framed: false, shortIn: 8,  longIn: 12, ratio: 1.5 },
  { sku: 'GLOBAL-FAP-16X24',       label: '16x24"',       price: 7900,  framed: false, shortIn: 16, longIn: 24, ratio: 1.5 },
  { sku: 'GLOBAL-FAP-24X36',       label: '24x36"',       price: 11500, framed: false, shortIn: 24, longIn: 36, ratio: 1.5 },
  { sku: 'GLOBAL-CFPM-MOTH-8X12',  label: '8x12" Framed', price: 11900, framed: true,  shortIn: 8,  longIn: 12, ratio: 1.5 },
  { sku: 'GLOBAL-CFPM-MOTH-16X24', label: '16x24" Framed',price: 24500, framed: true,  shortIn: 16, longIn: 24, ratio: 1.5 },
  { sku: 'GLOBAL-FAP-6X8',         label: '6x8"',         price: 2900,  framed: false, shortIn: 6,  longIn: 8,  ratio: 4/3 },
  { sku: 'GLOBAL-FAP-9X12',        label: '9x12"',        price: 4500,  framed: false, shortIn: 9,  longIn: 12, ratio: 4/3 },
  { sku: 'GLOBAL-FAP-12X16',       label: '12x16"',       price: 5900,  framed: false, shortIn: 12, longIn: 16, ratio: 4/3 },
];
const MIN_PRINT_DPI = 200;
const RATIO_TOLERANCE = 0.06;

function sizesForPhoto(longestPx, photoRatio) {
  return PRINT_SIZES.filter(s => {
    const fitsRes = !longestPx || longestPx >= s.longIn * MIN_PRINT_DPI;
    const fitsRatio = !photoRatio || Math.abs(s.ratio - photoRatio) <= RATIO_TOLERANCE;
    return fitsRes && fitsRatio;
  });
}
// ---------------------------------------------------------------------------

const SKIP_TAGS = new Set([
  'color', 'black & white', 'b&w', 'day', 'night', 'outdoor', 'indoor',
  'interior', 'exterior', 'dramatic', 'travel', 'nature', 'architecture',
  'city', 'street', 'landscape', 'portrait',
]);

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tagsArray(photo) {
  return (photo.tags || '').split(',').map(t => t.trim()).filter(Boolean);
}

function slugForPhoto(photo) {
  const raw = tagsArray(photo);
  const meaningful = raw.filter(t => !SKIP_TAGS.has(t.toLowerCase()));
  const pick = (meaningful.length ? meaningful : raw).slice(0, 3);
  let stem = slugify(pick.join('-'));
  if (!stem) stem = 'print';
  if (stem.length > 60) stem = stem.slice(0, 60).replace(/-+$/g, '');
  return `${stem}-${photo.id}`;
}

// Tokens that should render fully uppercase, not title-cased (JFK -> "JFK", not "Jfk").
const ACRONYMS = new Set([
  'jfk', 'nyc', 'usa', 'us', 'uk', 'la', 'sf', 'dc', 'uae', 'nasa', 'ufo',
]);

// Title-case a tag, but uppercase any whole word that is a known acronym
// (JFK -> "JFK", not "Jfk"). Handles words separated by spaces or hyphens.
function titleCasePart(part) {
  return String(part).split(/(\s+|-)/).map(token => (
    ACRONYMS.has(token.toLowerCase())
      ? token.toUpperCase()
      : token.replace(/\b\w/g, c => c.toUpperCase())
  )).join('');
}

function titleForPhoto(photo) {
  const raw = tagsArray(photo);
  const meaningful = raw.filter(t => !SKIP_TAGS.has(t.toLowerCase()));
  const parts = (meaningful.length ? meaningful : raw).slice(0, 3);
  if (!parts.length) return 'Fine Art Print';
  return parts.map(titleCasePart).join(' / ');
}

// Known location / subject / mood / medium vocab, used to build a natural
// human + agent readable description from the tag string. Kept loose: anything
// not classified just becomes a generic subject word.
const LOCATIONS = new Set(['nashville','brentwood','new york','los angeles','paris','monte carlo','versailles','washington dc','san juan','cannes','london','tokyo','beaulieu sur mer','villefranche sur mer','france','puerto rico','japan','uk','usa','monaco']);
const MOODS = new Set(['dramatic','moody','serene','vibrant','minimal','warm','cool','golden hour','blue hour']);
const MEDIA = new Set(['color','black & white','b&w']);

function classifyTags(photo) {
  const raw = tagsArray(photo);
  const lower = raw.map(t => t.toLowerCase());
  const locations = raw.filter((t, i) => LOCATIONS.has(lower[i]));
  const moods = raw.filter((t, i) => MOODS.has(lower[i]));
  const media = raw.filter((t, i) => MEDIA.has(lower[i]));
  const subjects = raw.filter((t, i) => !LOCATIONS.has(lower[i]) && !MOODS.has(lower[i]) && !MEDIA.has(lower[i]) && !SKIP_TAGS.has(lower[i]));
  return { locations, moods, media, subjects, raw };
}

// Title-case, with acronym awareness (JFK/DC/NYC stay uppercase). Shares the
// same ACRONYMS set as titleForPhoto so titles and descriptions stay consistent.
function tc(s) { return titleCasePart(s); }

// Descriptive alt text / description built from metadata. No em dashes.
function describePhoto(photo) {
  const c = classifyTags(photo);
  const subject = c.subjects.length ? c.subjects.map(tc).join(', ')
                 : (c.locations.length ? c.locations.map(tc).join(', ') : 'Fine art photograph');
  const where = c.locations.length ? ` in ${c.locations.map(tc).join(', ')}` : '';
  const medium = c.media.length ? (c.media.join(' ').toLowerCase().includes('b') && !c.media.join(' ').toLowerCase().includes('color') ? 'black and white ' : '') : '';
  const mood = c.moods.length ? `${c.moods.map(m => m.toLowerCase()).join(', ')} ` : '';
  // Alt text: short, concrete, no marketing.
  const alt = `${medium}${mood}photograph of ${subject.toLowerCase()}${where}, by Stuart Singleton`.replace(/\s+/g, ' ').trim();
  return { subject, where, medium, mood, alt };
}

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

// Pull for-sale photos + their largest-available dimensions. Master dims win;
// otherwise the largest preview/bordered asset. This mirrors the buy modal's
// "measure the master, fall back to the web file" behaviour.
async function fetchCatalog() {
  const headers = { apikey: SUPA_KEY, authorization: `Bearer ${SUPA_KEY}` };

  const photosRes = await fetch(
    `${SUPA_URL}/rest/v1/photos?select=id,tags,camera,src,span,mockup_url,for_sale,hidden` +
    `&for_sale=eq.true&hidden=eq.false&order=sort_order.asc,created_at.desc`,
    { headers });
  if (!photosRes.ok) throw new Error(`photos fetch ${photosRes.status}: ${await photosRes.text()}`);
  const photos = await photosRes.json();

  const assetsRes = await fetch(
    `${SUPA_URL}/rest/v1/photo_assets?select=photo_id,variant,width,height,is_print_default`,
    { headers });
  if (!assetsRes.ok) throw new Error(`assets fetch ${assetsRes.status}: ${await assetsRes.text()}`);
  const assets = await assetsRes.json();

  // Resolve best dims per photo. Prefer print-master; else largest of anything.
  const masterByPhoto = {};
  const bestAnyByPhoto = {};
  for (const a of assets) {
    if (!a.width || !a.height) continue;
    const longest = Math.max(a.width, a.height);
    if (a.variant === 'print-master') {
      const cur = masterByPhoto[a.photo_id];
      if (!cur || longest > Math.max(cur.width, cur.height)) masterByPhoto[a.photo_id] = a;
    }
    const curAny = bestAnyByPhoto[a.photo_id];
    if (!curAny || longest > Math.max(curAny.width, curAny.height)) bestAnyByPhoto[a.photo_id] = a;
  }

  const items = photos.map(p => {
    const master = masterByPhoto[p.id] || null;
    const best = master || bestAnyByPhoto[p.id] || null;
    const dims = best ? { w: best.width, h: best.height } : null;
    const longestPx = dims ? Math.max(dims.w, dims.h) : null;
    const ratio = dims ? (Math.max(dims.w, dims.h) / Math.min(dims.w, dims.h)) : null;

    const offered = sizesForPhoto(longestPx, ratio);
    const prices = offered.map(s => s.price);
    const priceRange = prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : null;

    const slug = slugForPhoto(p);
    const desc = describePhoto(p);

    return {
      id: p.id,
      slug,
      title: titleForPhoto(p),
      description: desc.alt,
      tags: tagsArray(p),
      camera: p.camera || null,
      src: p.src,
      ogImage: renderURL(p.src, 1200, 80),
      heroImage: renderURL(p.src, 1000, 82),
      pPage: `${SITE}/p?id=${p.id}`,
      printPage: `${SITE}/print/${slug}`,
      // Dimensions only when truthful (a real measured master/preview exists).
      hasMaster: !!master,
      pixelWidth: dims ? dims.w : null,
      pixelHeight: dims ? dims.h : null,
      aspectRatio: dims ? `${dims.w}:${dims.h}` : null,
      aspectRatioDecimal: ratio ? Number(ratio.toFixed(4)) : null,
      offeredSizes: offered.map(s => ({ sku: s.sku, label: s.label.replace(/"/g, 'in'), framed: s.framed, priceUSD: +(s.price / 100).toFixed(2) })),
      priceRangeUSD: priceRange ? { min: +(priceRange.min / 100).toFixed(2), max: +(priceRange.max / 100).toFixed(2) } : null,
      availability: offered.length ? 'InStock' : 'PreOrder',
      printReady: offered.length > 0,
    };
  });

  return { site: SITE, items, generatedAt: new Date().toISOString() };
}

module.exports = {
  fetchCatalog, PRINT_SIZES, MIN_PRINT_DPI, RATIO_TOLERANCE, sizesForPhoto,
  slugForPhoto, titleForPhoto, describePhoto, classifyTags, renderURL, SITE,
};

if (require.main === module) {
  fetchCatalog().then(c => {
    console.log(JSON.stringify(c, null, 2));
  }).catch(e => { console.error(e); process.exit(1); });
}
