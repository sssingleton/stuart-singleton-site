// /api/track — first-party analytics beacon for stuartsingleton.com.
//
// The browser sends a tiny JSON event (see ssTrack() in index.html). This edge
// function stamps it with Vercel's geo headers + a device class, drops obvious
// bots, and inserts it into Supabase `site_events` with the public anon key.
// The table is INSERT-only for anon (RLS); reads happen via admin-gated RPCs
// that back the Analytics panel in /mr.manager. No secrets live here — the anon
// key is the same one already shipped in index.html.

export const config = { runtime: 'edge' };

const SUPA_URL = 'https://zbcdeglxwrappriwpxwt.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiY2RlZ2x4d3JhcHByaXdweHd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzcyODUsImV4cCI6MjA4OTUxMzI4NX0.IMGxd2IIRvVWgA441aLFtH2VujrZgVRehv2Hb2qNEus';

// Main site events, plus the presets storefront (stuarts-presets.*) which posts here
// cross-origin with paths prefixed "presets:" — see src/lib/track.ts in that repo.
const EVENTS = new Set(['page_view','photo_view','buy_modal','add_to_cart','checkout_start','request_print','booking_open','cart_open','ship_blocked','ship_paper_only','open_in_safari','presets_click','preset_view','preset_redeem','preset_download']);
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|pinterest|whatsapp|telegram|discord|slack|embedly|iframely|preview|headless|lighthouse|pagespeed|gtmetrix|curl|wget|python-requests|httpclient|go-http|java\/|okhttp|axios|node-fetch/i;

function deviceOf(ua, hint) {
  if (BOT_RE.test(ua)) return 'bot';
  if (hint === 'mobile' || hint === 'tablet' || hint === 'desktop') return hint;
  if (/ipad|tablet|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android.+mobile/i.test(ua)) return 'mobile';
  if (/android/i.test(ua)) return 'tablet';
  if (/mozilla|applewebkit/i.test(ua)) return 'desktop';
  return 'unknown';
}

const clip = (s, n) => (typeof s === 'string' ? s.slice(0, n) : null);

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });

  let body;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400, headers: cors }); }
  if (!body || typeof body !== 'object') return new Response('bad body', { status: 400, headers: cors });

  const session = clip(body.s, 64);
  const event = body.e;
  if (!session || session.length < 8 || !EVENTS.has(event)) return new Response('bad event', { status: 400, headers: cors });

  const ua = req.headers.get('user-agent') || '';
  const device = deviceOf(ua, body.d);
  const h = (k) => { const v = req.headers.get(k); return v ? decodeURIComponent(v) : null; };

  const row = {
    session,
    event,
    path: clip(body.p, 200),
    photo_id: Number.isFinite(+body.id) && +body.id > 0 ? Math.floor(+body.id) : null,
    referrer: clip(body.r, 200),
    country: clip(h('x-vercel-ip-country'), 2),
    region: clip(h('x-vercel-ip-country-region'), 64),
    city: clip(h('x-vercel-ip-city'), 80),
    device,
    meta: body.m && typeof body.m === 'object' ? body.m : null,
  };

  // Bots are recorded (so the filter can be audited) but every RPC excludes them.
  const res = await fetch(`${SUPA_URL}/rest/v1/site_events`, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  return new Response(null, { status: res.ok ? 204 : 502, headers: cors });
}
