// vercel-analytics — admin-only proxy for Vercel Web Analytics.
//
// The /mr.manager Analytics panel calls this with the signed-in admin's JWT.
// We (1) verify the caller is an admin via public.is_site_admin(), then
// (2) forward a whitelisted query to api.vercel.com with VERCEL_TOKEN, which
// never leaves this function. Secret to set: VERCEL_TOKEN (Vercel → Account →
// Tokens; scope = the sssingleton's-projects team, read is enough).
//
// Body: { dataset?: 'visits'|'events', mode?: 'count'|'aggregate', since?, until?, by?: string[], filter?, limit? }

import { createClient } from 'npm:@supabase/supabase-js@2';

const TEAM_ID = 'team_hExOp7oiPoMswWedmoDfNhav';
const PROJECT_ID = 'prj_8ERiev3PpyS9auhzayIGcKGir2Jy'; // stuart-singleton-site
const ALLOWED_BY = new Set(['hour','day','week','month','year','country','deviceType','environment','requestPath','referrerHostname','osName','browserName','route','eventName','utm_source','utm_medium','utm_campaign','eventData/photo']);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const auth = req.headers.get('Authorization') || '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: roleErr } = await sb.rpc('is_site_admin');
  if (roleErr || !isAdmin) return json({ error: 'admin only' }, 403);

  const token = Deno.env.get('VERCEL_TOKEN');
  if (!token) return json({ error: 'VERCEL_TOKEN not set', setup: true }, 501);

  let q: any = {};
  try { q = await req.json(); } catch { /* defaults */ }
  const dataset = q.dataset === 'events' ? 'events' : 'visits';
  const mode = q.mode === 'aggregate' ? 'aggregate' : 'count';

  const params = new URLSearchParams({ teamId: TEAM_ID, projectId: PROJECT_ID });
  if (q.since) params.set('since', String(q.since));
  if (q.until) params.set('until', String(q.until));
  if (q.filter) params.set('filter', String(q.filter).slice(0, 300));
  if (mode === 'aggregate') {
    const by = Array.isArray(q.by) ? q.by.filter((b: string) => ALLOWED_BY.has(b)).slice(0, 2) : [];
    if (!by.length) return json({ error: 'by required' }, 400);
    for (const b of by) params.append('by', b);
    params.set('limit', String(Math.min(100, Math.max(1, +q.limit || 10))));
  }

  const url = `https://api.vercel.com/v1/query/web-analytics/${dataset}/${mode}?${params}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await r.text();
  if (!r.ok) return json({ error: 'vercel ' + r.status, detail: text.slice(0, 400) }, 502);
  return new Response(text, { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=60' } });
});
