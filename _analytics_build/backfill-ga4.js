#!/usr/bin/env node
/**
 * backfill-ga4.js — one-shot import of GA4 pageview history into Supabase
 * `site_traffic_baseline`, so the /mr.manager Analytics chart shows a "before"
 * baseline for days that predate first-party tracking (shipped 2026-09-03).
 *
 * The GA4 property (G-Y7P9FGW6PT) only ever received the initial page load of
 * the SPA, so treat these numbers as "landing loads", not true pageviews.
 *
 * ONE-TIME SETUP (Stuart, ~5 min):
 *   1. console.cloud.google.com → create/pick a project → enable
 *      "Google Analytics Data API".
 *   2. IAM → Service Accounts → create one → Keys → Add key → JSON. Save it as
 *      ~/ga4-sa.json (do NOT commit it).
 *   3. analytics.google.com → Admin → Property access management → add the
 *      service account's email as Viewer.
 *   4. Admin → Property details → copy the numeric Property ID.
 *   5. Supabase → Project Settings → API → copy the service_role key.
 *
 * RUN:
 *   GA4_PROPERTY_ID=123456789 GOOGLE_APPLICATION_CREDENTIALS=~/ga4-sa.json \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... node _analytics_build/backfill-ga4.js [--since 2026-03-01] [--dry]
 *
 * Zero npm deps: signs the service-account JWT with node:crypto, calls the
 * Data API over fetch, upserts rows via PostgREST. Idempotent (primary key on
 * day+path+country+source) — safe to re-run.
 */
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

const PROP = process.env.GA4_PROPERTY_ID;
const SA_PATH = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').replace(/^~/, os.homedir());
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPA_URL = 'https://zbcdeglxwrappriwpxwt.supabase.co';
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const sinceIdx = args.indexOf('--since');
const SINCE = sinceIdx > -1 ? args[sinceIdx + 1] : '2026-01-01';
const UNTIL = new Date(Date.now() - 864e5).toISOString().slice(0, 10); // through yesterday

if (!PROP || !SA_PATH || (!SRK && !DRY)) {
  console.error('Missing env. Need GA4_PROPERTY_ID, GOOGLE_APPLICATION_CREDENTIALS' + (DRY ? '' : ', SUPABASE_SERVICE_ROLE_KEY') + '. See header comment.');
  process.exit(1);
}

const b64u = (b) => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

async function accessToken() {
  const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = crypto.createSign('RSA-SHA256').update(header + '.' + claim).sign(sa.private_key);
  const jwt = header + '.' + claim + '.' + b64u(sig);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('token: ' + JSON.stringify(j));
  return j.access_token;
}

async function runReport(token, dimensions, metrics) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROP}:runReport`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: SINCE, endDate: UNTIL }],
        dimensions: dimensions.map((name) => ({ name })),
        metrics: metrics.map((name) => ({ name })),
        limit: 100000, offset,
      }),
    });
    const j = await r.json();
    if (j.error) throw new Error('GA4: ' + JSON.stringify(j.error));
    for (const row of j.rows || []) rows.push({ d: row.dimensionValues.map((v) => v.value), m: row.metricValues.map((v) => +v.value) });
    offset += (j.rows || []).length;
    if (!j.rows || offset >= (j.rowCount || 0)) break;
  }
  return rows;
}

const day = (yyyymmdd) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
const normPath = (p) => (p || '/').replace(/\?.*$/, '').replace(/\/+$/, '') || '/';

(async () => {
  const token = await accessToken();
  console.log(`GA4 property ${PROP}, ${SINCE} → ${UNTIL}`);

  // 1) per day × path: pageviews (visitors per path are not additive, so keep them per-path only)
  const byPath = await runReport(token, ['date', 'pagePath'], ['screenPageViews', 'activeUsers']);
  // 2) per day × country: pageviews + users
  const byCountry = await runReport(token, ['date', 'countryId'], ['screenPageViews', 'activeUsers']);
  // 3) per day: true unique users for the visitors line
  const byDay = await runReport(token, ['date'], ['screenPageViews', 'activeUsers']);

  const rows = [];
  for (const r of byPath) rows.push({ day: day(r.d[0]), path: normPath(r.d[1]), country: '', pageviews: r.m[0], visitors: r.m[1], source: 'ga4' });
  for (const r of byCountry) rows.push({ day: day(r.d[0]), path: '', country: (r.d[1] || '').slice(0, 2), pageviews: r.m[0], visitors: r.m[1], source: 'ga4' });
  for (const r of byDay) rows.push({ day: day(r.d[0]), path: '', country: '', pageviews: r.m[0], visitors: r.m[1], source: 'ga4' });

  // merge duplicate keys (path normalisation can collapse /shop and /shop/)
  const merged = new Map();
  for (const r of rows) {
    const k = `${r.day}|${r.path}|${r.country}`;
    const m = merged.get(k);
    if (m) { m.pageviews += r.pageviews; m.visitors = Math.max(m.visitors, r.visitors); } else merged.set(k, r);
  }
  const out = [...merged.values()];
  console.log(`${byDay.length} days, ${out.length} rows. Total landing loads: ${byDay.reduce((s, r) => s + r.m[0], 0)}`);
  if (DRY) { console.log(out.slice(0, 10)); return; }

  for (let i = 0; i < out.length; i += 500) {
    const chunk = out.slice(i, i + 500);
    const r = await fetch(`${SUPA_URL}/rest/v1/site_traffic_baseline?on_conflict=day,path,country,source`, {
      method: 'POST',
      headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk),
    });
    if (!r.ok) throw new Error(`upsert ${r.status}: ${await r.text()}`);
    console.log(`upserted ${Math.min(i + 500, out.length)}/${out.length}`);
  }
  console.log('done — reload /mr.manager and switch the range to 90 days.');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
