#!/usr/bin/env node
/**
 * generate-feeds.js — rebuilds the shopping catalog feeds from the live for-sale photos.
 *   pinterest-catalog.csv  (Pinterest pulls https://stuartsingleton.com/pinterest-catalog.csv daily)
 *   meta-catalog.csv       (Meta Commerce Manager: Catalog > Data sources > scheduled feed URL)
 *   tiktok-catalog.csv     (TikTok Ads catalog)
 * Row id = <photoId>-<sku minus GLOBAL->, e.g. 14-FAP-8X12. /checkout.html relies on this format.
 * Title + description come from the photos table (photos.title / photos.description, written per
 * photo from the image and editable in the DB). product-copy.json is only a fallback for a photo
 * whose DB fields are empty. The print line (real size range + framed) is appended per photo here.
 * Photos with no copy anywhere fall back to the old tag-built copy and are listed as a warning at
 * the end of the run: give them a title + description in the DB so every title stays unique.
 * Changing a title or blurb is safe: ids, links and prices don't depend on it. Do NOT edit a
 * photo's tags to change its name; the /print/<slug> URL is built from the tags.
 * Run from repo root:  node generate-feeds.js
 */
const fs = require('fs');
const path = require('path');
const { fetchCatalog } = require('./catalog-data.js');
const IMG_DIR = 'feed-img';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Meta/Pinterest fetch every image in one burst; Supabase Storage answers that with 429s.
// So feed images are copied once into /feed-img/<id>.jpg and served by Vercel's CDN.
async function ensureImage(it) {
  const file = path.join(IMG_DIR, `${it.id}.jpg`);
  if (fs.existsSync(file) && fs.statSync(file).size > 10000) return true;
  const url = it.src.replace('/object/public/', '/render/image/public/') + '?width=1200&quality=82&resize=contain';
  for (let a = 1; a <= 6; a++) {
    try {
      const r = await fetch(url);
      if (r.ok) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); await sleep(300); return true; }
      await sleep(a * 2000);
    } catch (e) { await sleep(a * 2000); }
  }
  return false;
}

function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const write = (file, header, rows) => fs.writeFileSync(file, [header.join(','), ...rows.map(r => header.map(h => esc(r[h])).join(','))].join('\n') + '\n');

const CAT = 'Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork';
const SKIP = new Set(['color', 'day', 'night', 'outdoor', 'indoor', 'travel', 'nature', 'black & white', 'b&w']);

async function main() {
  const prior = {};
  if (fs.existsSync('pinterest-catalog.csv')) {
    const [h, ...rs] = parseCSV(fs.readFileSync('pinterest-catalog.csv', 'utf8'));
    rs.forEach(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); prior[o.id] = o; });
  }
  const { items } = await fetchCatalog();
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const local = new Set();
  for (const it of items) if (await ensureImage(it)) local.add(it.id);
  const keep = new Set(items.map(i => `${i.id}.jpg`));
  for (const f of fs.readdirSync(IMG_DIR)) if (!keep.has(f)) { try { fs.unlinkSync(path.join(IMG_DIR, f)); } catch (e) {} }
  const COPY = fs.existsSync('product-copy.json') ? JSON.parse(fs.readFileSync('product-copy.json', 'utf8')) : {};
  const noCopy = [];
  const sizeTxt = s => s.label.replace(/\s*Framed$/i, '').replace(/in\b/, '"').replace('x', '×');
  const rows = [];
  for (const it of items) {
    const copy = it.hasCopy ? { title: it.title, blurb: `${it.sentence}.` } : COPY[String(it.id)];
    if (!copy) noCopy.push(it.id);
    const paper = it.offeredSizes.filter(s => !s.framed);
    const anyFramed = it.offeredSizes.some(s => s.framed);
    const range = paper.length > 1 ? `${sizeTxt(paper[0])} to ${sizeTxt(paper[paper.length - 1])}` : (paper.length ? sizeTxt(paper[0]) : '');
    const printLine = `Fine art photograph by Nashville photographer Stuart Singleton. Giclée print on archival paper${range ? `, ${range}` : ''}${anyFramed ? ', framed options available' : ''}. Printed on demand, free shipping.`;
    const tags = it.tags.map(t => t.trim().toLowerCase());
    const bw = tags.some(t => t.includes('black'));
    const subj = tags.filter(t => !SKIP.has(t)).map(t => t.replace(/\b\w/g, c => c.toUpperCase()));
    const name = subj.slice(0, 3).join(' — ') || it.title;
    const image = local.has(it.id) ? `https://stuartsingleton.com/${IMG_DIR}/${it.id}.jpg` : it.src.replace('/object/public/', '/render/image/public/') + '?width=1200&quality=82&resize=contain';
    for (const s of it.offeredSizes) {
      const id = `${it.id}-${s.sku.replace(/^GLOBAL-/, '')}`;
      const size = s.label.replace(/in\b/, '"').replace('x', '×');
      const old = prior[id];
      rows.push({
        id,
        title: copy ? copy.title.slice(0, 150) : old?.title || `${name}${bw ? ' in Black & White' : ''} — ${size}`.slice(0, 150),
        description: copy ? `${copy.blurb} ${printLine}` : old?.description || `Original fine-art photograph by Nashville-based photographer Stuart Singleton${it.camera === 'fujifilm-xt5' ? ', shot on a Fujifilm X-T5' : ''}. ${it.sentence.replace(/ No\. \d+$/, '').replace(/,? by Stuart Singleton$/, '')}${bw ? ', in black and white' : ''}. Museum-quality giclée print on archival fine-art paper${s.framed ? ', framed' : ''}. Printed on demand, free shipping.`,
        link: it.printPage,
        image_link: image,
        priceNum: s.priceUSD.toFixed(2),
        price: `${s.priceUSD.toFixed(2)} USD`,
        availability: 'in stock',
        condition: 'new',
        google_product_category: CAT,
        brand: 'Stuart Singleton',
        item_group_id: String(it.id),
        color: bw ? 'Black & White' : 'Color',
        size: s.label,
      });
    }
  }
  // id -> catalog title. checkout.html sends these so the Stripe line name matches the Meta
  // catalog title (Meta's checkout test flags a mismatch as "product name was incorrect").
  fs.writeFileSync('catalog-titles.json', JSON.stringify(Object.fromEntries(rows.map(r => [r.id, r.title]))));
  write('pinterest-catalog.csv', ['id','title','description','link','image_link','price','availability','google_product_category','brand','item_group_id','condition','color'], rows);
  write('meta-catalog.csv', ['id','title','description','availability','condition','price','link','image_link','brand','google_product_category','item_group_id','color','size'], rows);
  write('tiktok-catalog.csv', ['sku_id','title','description','availability','condition','price','currency','link','image_link','brand','google_product_category','item_group_id'],
    rows.map(r => ({ ...r, sku_id: r.id, price: r.priceNum, currency: 'USD' })));
  console.log(`feeds: ${items.length} photos, ${rows.length} rows (pinterest/meta/tiktok), ${local.size} images on site CDN`);
  if (noCopy.length) console.warn(`  ! ${noCopy.length} photo(s) have no title/description in the DB (generic title used): ${noCopy.join(', ')}`);
}
main().catch(e => { console.error(e); process.exit(1); });
