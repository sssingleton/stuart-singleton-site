import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// quote-sweep v1 (2026-11-02) — automatic Prodigi price pull.
//
// Re-quotes every print_products row with quote_sweep=true against every market, stalest first,
// a slice per run (pg_cron hourly → whole catalogue refreshed about once a day). Results land in
// public.prodigi_quotes. Then, per SKU × country:
//   * country in the product's free list → margin check only; below FLOOR is logged.
//   * country has a shipping_surcharges row with auto=true → fee re-priced to that row's
//     target_margin from the fresh quote (rounded UP to $5) and logged when it moves.
// Changes for ACTIVE products are emailed to Stuart as one digest (at most every 20 h).
//
// Read-only toward Prodigi (quotes create nothing). Writes only prodigi_quotes,
// shipping_surcharges (fee/quoted_* on auto rows), price_sweep_log.
// Auth: x-job-token must match app_job_tokens.name='quote-sweep' (same pattern as auto-title-photos).
//
// Body (all optional): { limit=40, skus?:string[], countries?:string[], dryRun?:bool,
//                        mode?: "sweep" | "describe", email?: bool=true }

const PRODIGI = "https://api.prodigi.com/v4.0";
const MARKETS = [
  "US", "CA", "AU", "NZ", "JP", "PH", "IN",
  "GB", "IE", "FR", "DE", "NL", "BE", "LU", "ES", "PT", "IT", "AT", "CH",
  "DK", "SE", "NO", "FI", "IS", "PL", "CZ", "SK", "HU", "SI", "HR", "RO",
  "BG", "GR", "EE", "LV", "LT", "MT",
];
const US_TAX = 0.0976;          // Prodigi bills Stuart sales tax on US production orders
const STRIPE_PCT = 0.029, STRIPE_FIXED = 30;
const FLOOR = 0.30;             // house rule: under 30% after all costs = not acceptable
const FROM_EMAIL = "prints@stuartsingleton.com";
const OWNER_EMAIL = "stuartssingleton@gmail.com";

const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// deno-lint-ignore no-explicit-any
const amt = (v: any): number | null => { const x = v && typeof v === "object" ? v.amount : v; const n = Number(x); return Number.isFinite(n) ? Math.round(n * 100) : null; };

function margin(priceCents: number, costCents: number): number {
  return (priceCents - costCents - (STRIPE_PCT * priceCents + STRIPE_FIXED)) / priceCents;
}
function feeFor(priceCents: number, costCents: number, target: number): number {
  const need = (costCents + STRIPE_FIXED) / (1 - STRIPE_PCT - target);
  return Math.max(0, Math.ceil((need - priceCents) / 500) * 500);
}

// deno-lint-ignore no-explicit-any
async function prodigi(path: string, key: string, body?: unknown): Promise<{ status: number; data: any; text: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${PRODIGI}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "X-API-Key": key, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    if (r.status === 429 || /^API calls/i.test(text)) { await sleep(3000 * (attempt + 1)); continue; }
    let data = null; try { data = JSON.parse(text); } catch { /* plain text */ }
    return { status: r.status, data, text };
  }
  return { status: 429, data: null, text: "rate limited" };
}

Deno.serve(async (req) => {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const tok = req.headers.get("x-job-token") ?? "";
    const { data: t } = await sb.from("app_job_tokens").select("token").eq("name", "quote-sweep").maybeSingle();
    if (!t?.token || tok !== t.token) return json({ error: "unauthorized" }, 401);

    const key = Deno.env.get("PRODIGI_API_KEY");
    if (!key) throw new Error("PRODIGI_API_KEY not set");
    const body = await req.json().catch(() => ({}));

    if (body.mode === "describe") {
      const out: Record<string, unknown> = {};
      for (const sku of (body.skus ?? []) as string[]) {
        const r = await prodigi(`/products/${encodeURIComponent(sku)}`, key);
        const p = r.data?.product;
        out[sku] = p ? { attributes: p.attributes, printAreas: p.printAreas, description: p.description } : { status: r.status, error: r.text.slice(0, 300) };
        await sleep(500);
      }
      return json(out);
    }

    const limit = Math.max(1, Math.min(150, Number(body.limit ?? 40)));
    const dryRun = body.dryRun === true;

    const { data: prods, error: pe } = await sb.from("print_products")
      .select("sku,price_cents,attributes,option_attributes,countries,shipping_method,active,channel,quote_sweep");
    if (pe) throw new Error(pe.message);
    const products = (prods ?? []).filter((p) => p.quote_sweep && (!body.skus || body.skus.includes(p.sku)));
    const markets = (body.countries as string[] | undefined) ?? MARKETS;

    const { data: qs } = await sb.from("prodigi_quotes").select("sku,country,cost_cents,ok,quoted_at");
    const prev = new Map((qs ?? []).map((q) => [`${q.sku}|${q.country}`, q]));
    const { data: ss } = await sb.from("shipping_surcharges").select("sku,country,fee_cents,target_margin,auto");
    const sur = new Map((ss ?? []).map((s) => [`${s.sku}|${s.country}`, s]));

    // stalest first (never quoted = oldest)
    const pairs: Array<{ p: typeof products[number]; c: string; at: number }> = [];
    for (const p of products) for (const c of markets) {
      const q = prev.get(`${p.sku}|${c}`);
      pairs.push({ p, c, at: q ? new Date(q.quoted_at).getTime() : 0 });
    }
    pairs.sort((a, b) => a.at - b.at);
    const slice = pairs.slice(0, limit);

    // deno-lint-ignore no-explicit-any
    const logs: any[] = [];
    // deno-lint-ignore no-explicit-any
    const results: any[] = [];

    async function one({ p, c }: { p: typeof products[number]; c: string }) {
      const attrs: Record<string, string> = { ...(p.attributes ?? {}) };
      for (const [k, vals] of Object.entries(p.option_attributes ?? {})) if (!(k in attrs) && Array.isArray(vals) && vals.length) attrs[k] = String(vals[0]);
      const r = await prodigi("/quotes", key!, {
        shippingMethod: p.shipping_method || "Standard", destinationCountryCode: c, currencyCode: "USD",
        items: [{ sku: p.sku, copies: 1, attributes: attrs, assets: [{ printArea: "default" }] }],
      });
      const q = r.data?.quotes?.[0];
      const row: Record<string, unknown> = { sku: p.sku, country: c, quoted_at: new Date().toISOString() };
      if (r.status >= 300 || !q || (r.data?.outcome && !/created/i.test(r.data.outcome))) {
        row.ok = false;
        row.error = (r.data ? JSON.stringify(r.data.issues ?? r.data.failures ?? r.data.outcome ?? r.data) : r.text).slice(0, 500);
        const s = sur.get(`${p.sku}|${c}`);
        if (p.active && (s || (p.countries ?? []).includes(c)) && prev.get(`${p.sku}|${c}`)?.ok !== false) {
          logs.push({ sku: p.sku, country: c, kind: "quote_failed", active: p.active, detail: String(row.error).slice(0, 300) });
        }
        results.push({ sku: p.sku, c, ok: false });
        return row;
      }
      const items = amt(q.costSummary?.items) ?? 0, ship = amt(q.costSummary?.shipping) ?? 0;
      const total = amt(q.costSummary?.totalCost) ?? items + ship;
      const tax = amt(q.costSummary?.totalTax) ?? Math.max(0, total - items - ship);
      const cost = total + (c === "US" ? Math.round(US_TAX * (items + ship)) : 0);
      const sh = q.shipments?.[0];
      Object.assign(row, {
        ok: true, error: null, items_cents: items, shipping_cents: ship, tax_cents: tax, total_cents: total, cost_cents: cost,
        carrier: sh?.carrier ? `${sh.carrier.name ?? ""} ${sh.carrier.service ?? ""}`.trim() : null,
        ships_from: sh?.fulfillmentLocation?.countryCode ?? null, method: q.shipmentMethod ?? p.shipping_method ?? null,
      });

      const free = (p.countries ?? []).includes(c);
      const s = sur.get(`${p.sku}|${c}`);
      let m = margin(p.price_cents, cost), fee: number | null = null;
      if (free) {
        const pc = prev.get(`${p.sku}|${c}`);
        const wasOk = !pc?.cost_cents || margin(p.price_cents, pc.cost_cents) >= FLOOR;
        if (m < FLOOR && wasOk) logs.push({ sku: p.sku, country: c, kind: "below_floor", margin: m.toFixed(3), active: p.active, detail: `free shipping, cost $${(cost / 100).toFixed(2)} vs price $${(p.price_cents / 100).toFixed(2)}` });
      } else if (s && s.auto) {
        fee = feeFor(p.price_cents, cost, Number(s.target_margin));
        m = margin(p.price_cents + fee, cost);
        if (!dryRun) {
          await sb.from("shipping_surcharges").update({ fee_cents: fee, quoted_cost_cents: cost, quoted_at: new Date().toISOString().slice(0, 10), note: `${row.carrier ?? ""} from ${row.ships_from ?? "?"} (auto)` })
            .eq("sku", p.sku).eq("country", c);
        }
        if (fee !== s.fee_cents) logs.push({ sku: p.sku, country: c, kind: "fee_changed", old_cents: s.fee_cents, new_cents: fee, margin: m.toFixed(3), active: p.active, detail: `cost $${(cost / 100).toFixed(2)}, target ${Math.round(Number(s.target_margin) * 100)}%` });
      }
      results.push({ sku: p.sku, c, cost, free, fee, margin: Math.round(m * 1000) / 10 });
      return row;
    }

    // Prodigi tolerates ~6 calls / 3 s.
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < slice.length; i += 6) {
      const t0 = Date.now();
      rows.push(...await Promise.all(slice.slice(i, i + 6).map(one)));
      const wait = 3100 - (Date.now() - t0);
      if (wait > 0 && i + 6 < slice.length) await sleep(wait);
    }
    if (!dryRun && rows.length) {
      const { error } = await sb.from("prodigi_quotes").upsert(rows, { onConflict: "sku,country" });
      if (error) throw new Error("upsert prodigi_quotes: " + error.message);
      if (logs.length) await sb.from("price_sweep_log").insert(logs);
    }

    // Digest email for active products, at most once every 20 h.
    let emailed = 0;
    if (!dryRun && body.email !== false) {
      const { data: last } = await sb.from("price_sweep_log").select("emailed_at").not("emailed_at", "is", null).order("emailed_at", { ascending: false }).limit(1);
      const lastAt = last?.[0]?.emailed_at ? new Date(last[0].emailed_at).getTime() : 0;
      if (Date.now() - lastAt > 20 * 3600e3) {
        const { data: pend } = await sb.from("price_sweep_log").select("*").is("emailed_at", null).eq("active", true).order("at");
        const rk = Deno.env.get("RESEND_API_KEY");
        if (pend?.length && rk) {
          const li = pend.map((l) => l.kind === "fee_changed"
            ? `<li><b>${l.sku} → ${l.country}</b>: shipping fee $${(l.old_cents / 100).toFixed(0)} → $${(l.new_cents / 100).toFixed(0)} (margin ${(l.margin * 100).toFixed(0)}%, ${l.detail})</li>`
            : l.kind === "below_floor"
              ? `<li><b>${l.sku} → ${l.country}</b>: margin dropped to ${(l.margin * 100).toFixed(0)}% (${l.detail}). Consider a surcharge or removing the country.</li>`
              : `<li><b>${l.sku} → ${l.country}</b>: Prodigi would not quote it (${l.detail}). Buyers there may hit a failed order.</li>`).join("");
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${rk}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: `Print shop <${FROM_EMAIL}>`, to: [OWNER_EMAIL], subject: `Print prices: ${pend.length} change${pend.length > 1 ? "s" : ""} from the Prodigi price check`, html: `<p>The automatic Prodigi price check found:</p><ul>${li}</ul><p>Fee changes are already live. Margins are after Stripe fees${""} and US sales tax.</p>` }),
          });
          if (r.ok) { await sb.from("price_sweep_log").update({ emailed_at: new Date().toISOString() }).in("id", pend.map((l) => l.id)); emailed = pend.length; }
          else console.error("resend failed", r.status, await r.text());
        }
      }
    }

    return json({ quoted: rows.length, remainingStale: Math.max(0, pairs.length - slice.length), failed: rows.filter((r) => !r.ok).length, logged: logs.length, emailed, dryRun, results: body.verbose ? results : undefined });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
