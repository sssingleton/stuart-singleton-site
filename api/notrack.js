// /api/notrack — stop counting this browser in site analytics (first-party /api/track).
// Sets the ss_notrack cookie for a year; /api/track drops every event that carries it.
// Used by Claude's headless test browsers before they touch the site, and by Stuart on any
// device he doesn't sign into /mr.manager with. /api/notrack?off turns counting back on.
// ?to=/some/path redirects there afterwards (same-site paths only).
export const config = { runtime: 'edge' };

export default function handler(req) {
  const url = new URL(req.url);
  const off = url.searchParams.has('off');
  const to = url.searchParams.get('to');
  const dest = to && to.startsWith('/') && !to.startsWith('//') ? to : null;
  const cookie = off
    ? 'ss_notrack=; Path=/; Max-Age=0; SameSite=Lax; Secure'
    : 'ss_notrack=1; Path=/; Max-Age=31536000; SameSite=Lax; Secure';
  const headers = { 'Set-Cookie': cookie, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
  if (dest) return new Response(null, { status: 302, headers: { ...headers, Location: dest } });
  return new Response(off ? 'Analytics counting is back ON for this browser.\n' : 'This browser is no longer counted in site analytics.\n',
    { status: 200, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
}
