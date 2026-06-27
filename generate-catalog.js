#!/usr/bin/env node
/**
 * generate-catalog.js
 * ----------------------------------------------------------------------------
 * Builds /catalog.json: a machine-readable feed of every for-sale photo for AI
 * agents and AI search. Driven from catalog-data.js, the same Supabase query +
 * pricing/size logic the shop and buy modal use. Sizes are gated by pixels at
 * 200 DPI; nothing is listed that the checkout would reject. Masters stay
 * private (only measured dimensions are exposed, never the file).
 *
 * Run from repo root:  node generate-catalog.js
 * Output:              ./catalog.json
 */

const fs = require('fs');
const path = require('path');
const { fetchCatalog, SITE } = require('./catalog-data.js');

async function main() {
  const { items, generatedAt } = await fetchCatalog();

  const feed = {
    '@context': 'https://schema.org',
    name: 'Stuart Singleton Fine Art Print Catalog',
    description: 'Machine-readable catalog of for-sale fine art photography prints by Stuart Singleton. Printed on demand and shipped worldwide. Prices in USD, all-in with free shipping. Print sizes are gated by image resolution at a 200 DPI floor, so only no-crop sizes a photo can print sharply are listed.',
    creator: { '@type': 'Person', name: 'Stuart Singleton', url: SITE },
    url: `${SITE}/catalog.json`,
    shop: `${SITE}/shop`,
    currency: 'USD',
    priceModel: 'All-in pricing with free worldwide shipping. Unframed prints $29 to $115. Framed prints $119 to $245. A size is offered only when the photo has enough resolution to print it sharply at 200 DPI without cropping.',
    generatedAt,
    count: items.length,
    products: items.map(it => ({
      id: it.id,
      title: it.title,
      description: it.description,
      url: it.pPage,
      printPage: it.printPage,
      image: it.ogImage,
      tags: it.tags,
      camera: it.camera,
      aspectRatio: it.aspectRatio,
      aspectRatioDecimal: it.aspectRatioDecimal,
      pixelWidth: it.pixelWidth,
      pixelHeight: it.pixelHeight,
      availability: it.availability,
      printReady: it.printReady,
      priceRangeUSD: it.priceRangeUSD,
      sizes: it.offeredSizes,
    })),
  };

  fs.writeFileSync(path.join(__dirname, 'catalog.json'), JSON.stringify(feed, null, 2));
  const ready = items.filter(i => i.printReady).length;
  console.log(`Wrote catalog.json: ${items.length} products (${ready} print-ready, ${items.length - ready} pre-order).`);
}

main().catch(e => { console.error(e); process.exit(1); });
