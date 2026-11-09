import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { quoteDigital, cleanSrc } from "./_digital.ts";

// create-digital-checkout v1 (2026-11-09, unified Shop). One checkout for the Shop cart:
//   * packIds: Halation profiles + preset packs. Tier pricing computed HERE from the DB.
//   * items (optional): prints, exactly as create-checkout-session takes them. They are priced by
//     calling create-checkout-session with quoteOnly:true (same size gate, bulk tiers, countries,
//     destination fees; it creates nothing), then this function opens ONE Stripe session with
//     shipping + print lines + digital lines and writes the print_orders row in the v37 shape, so
//     stripe-webhook / Prodigi / Meta CAPI see an ordinary print order. create-checkout-session
//     itself is untouched.
//   * Digital part: preset_orders row (kind=bundle, pack_ids). metadata[kind]=pack + order_id for
//     digital-only, or metadata[kind]=print + digital=1 for mixed; preset-webhook v9 delivers.
//   * quoteOnly:true prices everything and creates nothing.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const withSession = (u: string) => u.includes("{CHECKOUT_SESSION_ID}") ? u : u + (u.includes("?") ? "&" : "?") + "session_id={CHECKOUT_SESSION_ID}";

type PrintLine = { photoId: number | string; sku: string; copies: number; unitPrice: number; label: string; name: string; description: string };
type PrintQuote = { bulkPct: number; destination: string | null; shippingCents: number; allowedCountries: string[]; amountTotal: number; lines: PrintLine[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const dq = await quoteDigital(supabase, body.packIds);
    if ("error" in dq) return json({ error: dq.error }, dq.status);

    // ── PRINTS (optional) ── priced by the print checkout itself, quote-only.
    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
    let pq: PrintQuote | null = null;
    if (rawItems.length) {
      if (body.gallery != null) return json({ error: "Gallery orders can't include presets or profiles." }, 400);
      const items = rawItems.map((it: Record<string, unknown>) => ({
        photoId: it.photoId, sku: it.sku, frameColor: it.frameColor, variant: it.variant, copies: it.copies, title: it.title,
      }));
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/create-checkout-session`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, destination: body.destination, quoteOnly: true, successUrl: "x", cancelUrl: "x" }),
      });
      const q = await r.json();
      if (!r.ok || !q.quote) return json({ error: q.error ?? "Could not price the prints in your cart." }, r.status >= 400 ? r.status : 502);
      pq = q as PrintQuote;
    }

    const printCents = pq ? pq.lines.reduce((n, l) => n + l.unitPrice * l.copies, 0) : 0;
    if (body.quoteOnly === true) {
      return json({ quote: true, digital: dq, prints: pq, amountTotal: dq.cents + printCents + (pq?.shippingCents ?? 0) });
    }

    const { successUrl, cancelUrl } = body;
    if (typeof successUrl !== "string" || typeof cancelUrl !== "string") return json({ error: "successUrl and cancelUrl are required" }, 400);
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const orderId = crypto.randomUUID();
    const src = cleanSrc(body.src);
    const p = new URLSearchParams();
    p.append("mode", "payment");
    p.append("success_url", withSession(successUrl));
    p.append("cancel_url", cancelUrl);
    let li = 0;

    // Print lines first, mirroring create-checkout-session v37 (names, descriptions, images, shipping).
    const itemsJson: Array<Record<string, unknown>> = [];
    if (pq) {
      pq.allowedCountries.forEach((c, i) => p.append(`shipping_address_collection[allowed_countries][${i}]`, c));
      const ship = pq.shippingCents;
      p.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
      p.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(ship));
      p.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
      p.append("shipping_options[0][shipping_rate_data][display_name]", ship ? "Express courier shipping" : "Free shipping");
      p.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
      p.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "5");
      p.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
      p.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "12");
      for (let k = 0; k < pq.lines.length; k++) {
        const l = pq.lines[k];
        const raw = rawItems[k] as Record<string, unknown>;
        if (String(raw.sku ?? "").toUpperCase() !== l.sku) return json({ error: "Cart changed, please try again." }, 409);
        const { data: photo } = await supabase.from("photos").select("src").eq("id", l.photoId).maybeSingle();
        p.append(`line_items[${li}][price_data][currency]`, "usd");
        p.append(`line_items[${li}][price_data][unit_amount]`, String(l.unitPrice));
        p.append(`line_items[${li}][price_data][product_data][name]`, l.name);
        if (l.description) p.append(`line_items[${li}][price_data][product_data][description]`, l.description);
        if (photo?.src) p.append(`line_items[${li}][price_data][product_data][images][0]`, photo.src);
        p.append(`line_items[${li}][quantity]`, String(l.copies));
        li++;
        const variant = (raw.variant === "bordered" || raw.variant === "alt-crop") ? String(raw.variant) : "print-master";
        itemsJson.push({ photo_id: l.photoId, sku: l.sku, frame_color: (raw.frameColor as string) ?? null, variant, copies: l.copies });
      }
    } else {
      p.append("allow_promotion_codes", "true"); // digital-only: launch / IG codes. Print carts never took codes.
    }

    for (const l of dq.lines) {
      p.append(`line_items[${li}][price_data][currency]`, "usd");
      p.append(`line_items[${li}][price_data][unit_amount]`, String(l.cents));
      p.append(`line_items[${li}][price_data][product_data][name]`, l.name);
      p.append(`line_items[${li}][price_data][product_data][description]`, l.description);
      if (l.image) p.append(`line_items[${li}][price_data][product_data][images][0]`, l.image);
      p.append(`line_items[${li}][quantity]`, "1");
      li++;
    }

    if (pq) {
      p.append("metadata[kind]", "print");
      p.append("metadata[order_kind]", itemsJson.length > 1 ? "cart" : "single");
      p.append("metadata[item_count]", String(itemsJson.length));
      p.append("metadata[bulk_pct]", String(pq.bulkPct));
      if (pq.destination) p.append("metadata[destination]", pq.destination);
      if (pq.shippingCents) p.append("metadata[ship_cents]", String(pq.shippingCents));
      p.append("metadata[digital]", "1");
      p.append("metadata[digital_order_id]", orderId);
    } else {
      p.append("metadata[kind]", "pack");
      p.append("metadata[order_id]", orderId);
    }
    if (src) p.append("metadata[src]", src);

    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST", headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" }, body: p.toString(),
    });
    const session = await r.json();
    if (!r.ok) return json({ error: "Stripe error", detail: session }, 502);

    // Both rows must exist before the buyer gets a URL, or a paid order could go unfulfilled.
    if (pq) {
      const first = itemsJson[0];
      const { error: pErr } = await supabase.from("print_orders").insert({
        photo_id: first.photo_id, sku: itemsJson.length > 1 ? "MULTI" : first.sku,
        frame_color: itemsJson.length > 1 ? null : first.frame_color,
        copies: itemsJson.reduce((n, it) => n + (it.copies as number), 0),
        stripe_session_id: session.id, status: "pending", amount_total: printCents + pq.shippingCents, currency: "usd", items: itemsJson,
      });
      if (pErr) { console.error("print_orders insert failed:", pErr); return json({ error: "Could not start checkout. Please try again." }, 500); }
    }
    const { error } = await supabase.from("preset_orders").insert({
      id: orderId, kind: "bundle", pack_id: dq.packIds[0], pack_ids: dq.packIds, stripe_session_id: session.id,
      status: "pending", amount_total: dq.cents, currency: "usd", src,
    });
    if (error) { console.error("preset_orders insert failed:", error); return json({ error: "Could not start checkout. Please try again." }, 500); }
    return json({ url: session.url });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
