// /api/pin — sends Pinterest's crawler from an old pin link (/p?id=N or /shop?buy=N) to that
// print's own page, /print/<slug>. Those old links are app routes whose static HTML is the
// homepage, so Pinterest saw no title, price or stock and the pins couldn't show a price.
// Only Pinterest's user agent is routed here (see vercel.json); people still get the app.
// The id -> page map comes from /catalog.json, which the "Rebuild shop feeds" job keeps current.
export const config = { runtime: 'edge' };
let pages = null, loadedAt = 0;
export default async function handler(req) {
  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || '').replace(/\D/g, '');
  let dest = 'https://stuartsingleton.com/prints';
  try {
    if (!pages || Date.now() - loadedAt > 10 * 60 * 1000) {
      const r = await fetch(new URL('/catalog.json', url.origin));
      const c = await r.json();
      pages = Object.fromEntries((c.products || []).map(p => [String(p.id), p.printPage]));
      loadedAt = Date.now();
    }
    if (pages[id]) dest = pages[id];
  } catch (e) {}
  return new Response(null, { status: 301, headers: { Location: dest, 'Cache-Control': 'public, max-age=3600' } });
}
