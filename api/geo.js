// /api/geo — tells the storefront which country the visitor is in, from Vercel's
// edge geo headers, so the buy modal can say "ships to Canada — paper only" or
// "we don't ship to India yet" BEFORE the buyer reaches Stripe's address form.
// Before this, a blocked-country buyer discovered it as a dead country dropdown
// on the Stripe page, with no explanation and no way to ask.
export const config = { runtime: 'edge' };
export default function handler(req) {
  const h = (k) => { const v = req.headers.get(k); return v ? decodeURIComponent(v) : null; };
  return new Response(JSON.stringify({ country: h('x-vercel-ip-country'), region: h('x-vercel-ip-country-region'), city: h('x-vercel-ip-city') }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}
