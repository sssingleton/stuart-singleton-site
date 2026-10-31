// auto-title-photos: writes title, description and location for photos that have none.
//
// Runs on its own: pg_cron calls it every 10 minutes while any photo is untitled
// (job "auto-title-photos", token in public.app_job_tokens), and /mr.manager calls it
// right after a Bulk Upload finishes (admin JWT, checked with public.is_site_admin()).
// The catalog feeds pick the new copy up on their next GitHub Action run.
//
// Body (optional): { ids?: number[], limit?: number }   default: up to 8 untitled photos, oldest first
// Only fills rows whose title is still empty, so it never overwrites Stuart's edits and
// two overlapping runs can't fight over a row.
//
// House style (matches the 2026-10-30 batch, Decision 299/300):
//   title "<what's in it>, <place>", no size, no em/en dashes; description 1-2 plain sentences.
//   Place: Stuart's tags first. Inside the Nashville area the tag (Nashville / Franklin) wins.
//   Same-shoot neighbours (nearby IDs, same tags) lend their place when tags only name a state.
//   Exact GPS never goes into public columns.
// AI: GEMINI_API_KEY first, ANTHROPIC_API_KEY fallback (same secrets as generate-preset).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-job-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const URL_ = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    place: { type: ['string', 'null'] },
    region: { type: ['string', 'null'] },
    country: { type: ['string', 'null'] },
    landmark: { type: ['string', 'null'] },
    location_note: { type: 'string' },
  },
  required: ['title', 'description', 'place', 'region', 'country', 'landmark', 'location_note'],
  additionalProperties: false,
};

const SYSTEM = `You write print-shop copy for Stuart Singleton's fine art photography (stuartsingleton.com). For ONE photo you get the image, Stuart's tags, the camera, and nearby photos from his catalog with their finished copy. Return the JSON fields.

TITLE
- What is actually in the photo, then the place: "Fog in the Valley, Vermont", "Old Farm Trucks in the Grass, Farmville". 3 to 9 words before the comma.
- Specific and visual (subject, light, color, mood). Must not repeat any title listed under "Titles already used".
- No print size, no camera name, no em dashes or en dashes, no quotes, no emoji, no hype ("stunning", "breathtaking").
- Use the most specific place you are sure of; a state or country is fine when the town is unknown.

DESCRIPTION
- 1 or 2 plain sentences, 12 to 35 words, describing what a buyer sees. Mention the place naturally once.
- Same voice as the neighbours' descriptions. No em dashes, no hype, no "this photo/this image", no calls to action.

LOCATION (public columns, never coordinates)
- Stuart's tags are the main evidence. A town or city tag is the place. If the tags only name a state or region, and a neighbour from the same shoot (close ID, same tags) has a place, reuse that neighbour's place, region and country.
- Nashville area rule: if tags say nashville or franklin, place is that tag ("Nashville" or "Franklin"), region "Tennessee", even if the image or GPS suggests a more exact spot. Never name a neighbourhood, street or venue there unless it is in the tags.
- region = state/province or the region a European shot belongs to; country in English ("United States", "France").
- landmark: only a named public landmark you can clearly recognise in the image or that a tag names; otherwise null. Do not guess.
- location_note: start with "[auto]", then in one short sentence say where the place came from (tags, neighbour shoot, recognised landmark) and anything Stuart should check. Keep it under 160 characters.`;

type Photo = { id: number; src: string; tags: string | null; camera: string | null; created_at: string };

async function imageB64(src: string): Promise<{ data: string; mime: string }> {
  const clean = src.split('?')[0];
  const render = clean.replace('/object/public/', '/render/image/public/') + '?width=1024&quality=80&resize=contain';
  for (const u of [render, clean]) {
    for (let a = 1; a <= 3; a++) {
      const r = await fetch(u);
      if (r.ok) {
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.length > 4 * 1048576) break; // too big for the model; try the next URL
        return { data: encodeBase64(buf), mime: r.headers.get('content-type')?.split(';')[0] || 'image/jpeg' };
      }
      if (r.status === 429) await new Promise((s) => setTimeout(s, a * 2000)); else break;
    }
  }
  throw new Error('could not download image');
}

async function ask(prompt: string, img: { data: string; mime: string }): Promise<any> {
  const g = Deno.env.get('GEMINI_API_KEY');
  if (g) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': g },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM + '\n\nReply with ONE JSON object matching this schema:\n' + JSON.stringify(SCHEMA) }] },
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: img.mime, data: img.data } }, { text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      }),
    });
    if (!r.ok) throw new Error('gemini ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    const text = (d?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
    return JSON.parse(text.replace(/```json\s*|```/g, '').trim());
  }
  const a = Deno.env.get('ANTHROPIC_API_KEY');
  if (!a) throw new Error('no AI key: set GEMINI_API_KEY or ANTHROPIC_API_KEY');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': a, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 1024, system: SYSTEM,
      tools: [{ name: 'photo_copy', description: 'The copy for this photo', input_schema: SCHEMA }],
      tool_choice: { type: 'tool', name: 'photo_copy' },
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.data } }, { type: 'text', text: prompt }] }],
    }),
  });
  if (!r.ok) throw new Error('anthropic ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const d = await r.json();
  return d.content.find((b: any) => b.type === 'tool_use')?.input;
}

const tidy = (s: unknown) => (typeof s === 'string' ? s.replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim() : null) || null;

async function titleOne(p: Photo, used: Set<string>) {
  // Neighbours: closest titled photos by ID (same shoot is usually consecutive IDs).
  const lo = await admin.from('photos').select('id,tags,title,description,place,region,country,landmark,location_note')
    .not('title', 'is', null).lt('id', p.id).order('id', { ascending: false }).limit(8);
  const hi = await admin.from('photos').select('id,tags,title,description,place,region,country,landmark,location_note')
    .not('title', 'is', null).gt('id', p.id).order('id', { ascending: true }).limit(4);
  const neigh = [...(lo.data || []), ...(hi.data || [])].sort((a, b) => Math.abs(a.id - p.id) - Math.abs(b.id - p.id));
  const geo = await admin.from('photo_geo').select('lat,lng,taken_at').eq('photo_id', p.id).maybeSingle();

  const img = await imageB64(p.src);
  const base = [
    `Photo #${p.id}. Camera: ${p.camera || 'unknown'}. Uploaded ${p.created_at.slice(0, 10)}.`,
    `Stuart's tags: ${p.tags || '(none)'}`,
    geo.data ? `Private GPS (use only to pick the town; never output it): ${geo.data.lat}, ${geo.data.lng}${geo.data.taken_at ? ', taken ' + geo.data.taken_at : ''}` : 'No GPS.',
    '',
    'Nearby photos in the catalog (id | tags | title | description | place / region / country | landmark | note):',
    ...neigh.map((n) => `#${n.id} | ${n.tags} | ${n.title} | ${n.description} | ${n.place ?? '-'} / ${n.region ?? '-'} / ${n.country ?? '-'} | ${n.landmark ?? '-'} | ${n.location_note ?? ''}`),
  ].join('\n');

  let out: any = null, dupNote = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const keys = new Set<string>();
    neigh.forEach((n) => [n.place, n.region].forEach((k) => k && keys.add(String(k).toLowerCase())));
    const nearTitles = [...used].filter((t) => [...keys].some((k) => t.includes(k))).slice(0, 150);
    const prompt = base + `\n\nTitles already used nearby (yours must differ):\n${nearTitles.join('\n') || '(none)'}${dupNote}`;
    out = await ask(prompt, img);
    out.title = tidy(out.title);
    if (!out.title || !tidy(out.description)) { dupNote = '\n\nYour last answer was missing a title or description.'; continue; }
    if (!used.has(out.title.toLowerCase())) break;
    dupNote = `\n\n"${out.title}" is already taken. Write a different, more specific title.`;
    if (attempt === 3) out.location_note = (out.location_note || '[auto]') + ' Title may repeat another photo.';
  }
  const row = {
    title: out.title,
    description: tidy(out.description),
    place: tidy(out.place), region: tidy(out.region), country: tidy(out.country), landmark: tidy(out.landmark),
    location_note: (tidy(out.location_note) || '[auto]').startsWith('[auto]') ? tidy(out.location_note) : '[auto] ' + tidy(out.location_note),
  };
  const up = await admin.from('photos').update(row).eq('id', p.id).is('title', null).select('id');
  if (up.error) throw up.error;
  if (row.title) used.add(row.title.toLowerCase());
  return { id: p.id, title: row.title, place: row.place ?? row.region, written: (up.data || []).length > 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // Who may run it: the cron (job token) or a signed-in site admin.
  const jobToken = req.headers.get('x-job-token');
  let ok = false;
  if (jobToken) {
    const t = await admin.from('app_job_tokens').select('token').eq('name', 'auto-title').maybeSingle();
    ok = !!t.data && t.data.token === jobToken;
  } else {
    const auth = req.headers.get('Authorization') || '';
    const user = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data } = await user.rpc('is_site_admin');
    ok = data === true;
  }
  if (!ok) return json({ error: 'not allowed' }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const limit = Math.min(15, Math.max(1, +body.limit || 8));

  let q = admin.from('photos').select('id,src,tags,camera,created_at').is('title', null).order('id', { ascending: true }).limit(limit);
  if (Array.isArray(body.ids) && body.ids.length) q = q.in('id', body.ids.map(Number).filter(Boolean).slice(0, 50));
  const todo = await q;
  if (todo.error) return json({ error: todo.error.message }, 500);
  if (!todo.data?.length) return json({ done: [], failed: [], remaining: 0 });

  const all = await admin.from('photos').select('title').not('title', 'is', null);
  const used = new Set<string>((all.data || []).map((r: any) => String(r.title).toLowerCase()));

  const done: any[] = [], failed: any[] = [];
  const started = Date.now();
  for (const p of todo.data as Photo[]) {
    if (Date.now() - started > 110_000) break; // stay inside the edge function time limit; the next run picks up the rest
    try { done.push(await titleOne(p, used)); }
    catch (e) { failed.push({ id: p.id, error: String((e as any)?.message || e).slice(0, 200) }); }
  }
  const left = await admin.from('photos').select('id', { count: 'exact', head: true }).is('title', null);
  return json({ done, failed, remaining: left.count ?? null });
});
