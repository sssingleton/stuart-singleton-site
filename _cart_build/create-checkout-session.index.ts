import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// create-checkout-session v24 — MULTI-ITEM CART + backward-compatible single item
//
// Accepts EITHER:
//   • legacy single: { photoId, sku, frameColor, variant, copies, successUrl, cancelUrl }
//   • new cart:      { items:[{ photoId, sku, frameColor, variant, copies }], successUrl, cancelUrl }
//
// Every item is validated the SAME way as before: SKU→price map, variant
// whitelist, photo exists + for_sale, and the server-side resolution/ratio SIZE
// GATE against the photo's print-master. One Stripe session is created with one
// line item per cart entry. The full item list is stored on print_orders.items
// (JSONB) so the webhook can fulfil each print. Single orders ALSO keep the old
// scalar columns + metadata so an un-upgraded webhook can still fulfil them.
// Pricing is unchanged from v23.
// ─────────────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SKU_LABELS: Record<string, string> = {
  "GLOBAL-FAP-4X6":   "Fine Art Print — 4×6\"",
  "GLOBAL-FAP-6X9":   "Fine Art Print — 6×9\"",
  "GLOBAL-FAP-6X8":   "Fine Art Print — 6×8\"",
  "GLOBAL-FAP-8X10":  "Fine Art Print — 8×10\"",
  "GLOBAL-FAP-8X12":  "Fine Art Print — 8×12\"",
  "GLOBAL-FAP-9X12":  "Fine Art Print — 9×12\"",
  "GLOBAL-FAP-12X16": "Fine Art Print — 12×16\"",
  "GLOBAL-FAP-12X18": "Fine Art Print — 12×18\"",
  "GLOBAL-FAP-16X24": "Fine Art Print — 16×24\"",
  "GLOBAL-FAP-18X24": "Fine Art Print — 18×24\"",
  "GLOBAL-FAP-24X36": "Fine Art Print — 24×36\"",
  "GLOBAL-CFPM-MOTH-8X12":  "Framed Print — 8×12\"",
  "GLOBAL-CFPM-MOTH-16X24": "Framed Print — 16×24\"",
  "GLOBAL-CFPM-8X10":  "Framed Print — 8×10\"",
  "GLOBAL-CFPM-12X16": "Framed Print — 12×16\"",
  "GLOBAL-CFPM-16X24": "Framed Print — 16×24\"",
};

const PRICES_CENTS: Record<string, number> = {
  "GLOBAL-FAP-4X6":   2900,
  "GLOBAL-FAP-6X9":   3500,
  "GLOBAL-FAP-8X12":  4500,
  "GLOBAL-FAP-16X24": 7900,
  "GLOBAL-FAP-24X36": 11500,
  "GLOBAL-FAP-6X8":   2900,
  "GLOBAL-FAP-9X12":  4500,
  "GLOBAL-FAP-12X16": 5900,
  "GLOBAL-FAP-8X10":  3500,
  "GLOBAL-FAP-12X18": 5900,
  "GLOBAL-FAP-18X24": 8500,
  "GLOBAL-CFPM-MOTH-8X12":  11900,
  "GLOBAL-CFPM-MOTH-16X24": 24500,
  "GLOBAL-CFPM-8X10":  12000,
  "GLOBAL-CFPM-12X16": 16000,
  "GLOBAL-CFPM-16X24": 20900,
};

const MIN_PRINT_DPI = 200;
const RATIO_TOLERANCE = 0.06;
const NO_MASTER_ASSUMED_LONG_PX = 2048;

const SKU_PRINT_DIMS: Record<string, { shortIn: number; longIn: number; ratio: number }> = {
  "GLOBAL-FAP-4X6":   { shortIn: 4,  longIn: 6,  ratio: 1.5 },
  "GLOBAL-FAP-6X9":   { shortIn: 6,  longIn: 9,  ratio: 1.5 },
  "GLOBAL-FAP-8X12":  { shortIn: 8,  longIn: 12, ratio: 1.5 },
  "GLOBAL-FAP-16X24": { shortIn: 16, longIn: 24, ratio: 1.5 },
  "GLOBAL-FAP-24X36": { shortIn: 24, longIn: 36, ratio: 1.5 },
  "GLOBAL-CFPM-MOTH-8X12":  { shortIn: 8,  longIn: 12, ratio: 1.5 },
  "GLOBAL-CFPM-MOTH-16X24": { shortIn: 16, longIn: 24, ratio: 1.5 },
  "GLOBAL-FAP-6X8":   { shortIn: 6,  longIn: 8,  ratio: 4 / 3 },
  "GLOBAL-FAP-9X12":  { shortIn: 9,  longIn: 12, ratio: 4 / 3 },
  "GLOBAL-FAP-12X16": { shortIn: 12, longIn: 16, ratio: 4 / 3 },
  "GLOBAL-FAP-8X10":  { shortIn: 8,  longIn: 10, ratio: 10 / 8 },
  "GLOBAL-FAP-12X18": { shortIn: 12, longIn: 18, ratio: 1.5 },
  "GLOBAL-FAP-18X24": { shortIn: 18, longIn: 24, ratio: 24 / 18 },
  "GLOBAL-CFPM-8X10":  { shortIn: 8,  longIn: 10, ratio: 10 / 8 },
  "GLOBAL-CFPM-12X16": { shortIn: 12, longIn: 16, ratio: 4 / 3 },
  "GLOBAL-CFPM-16X24": { shortIn: 16, longIn: 24, ratio: 1.5 },
};

function sizeAllowed(
  skuUpper: string,
  masterLong: number | null,
  masterShort: number | null,
): { ok: boolean; reason?: string } {
  const dims = SKU_PRINT_DIMS[skuUpper];
  if (!dims) return { ok: true };
  const neededLongPx = dims.longIn * MIN_PRINT_DPI;
  if (!masterLong || !masterShort) {
    if (NO_MASTER_ASSUMED_LONG_PX >= neededLongPx) return { ok: true };
    return { ok: false, reason: "This size isn’t available for this photo yet — a larger version is being prepared." };
  }
  if (masterLong < neededLongPx) {
    return { ok: false, reason: "This size isn’t available at print quality for this photo." };
  }
  const masterRatio = masterLong / masterShort;
  if (Math.abs(masterRatio - dims.ratio) > RATIO_TOLERANCE) {
    return { ok: false, reason: "This size’s proportions don’t match this photo." };
  }
  return { ok: true };
}

const FRAMED_BLOCKED_COUNTRIES = ["CA"];

// deno-lint-ignore no-explicit-any
async function masterDims(supabase: any, photoId: number | string): Promise<{ long: number | null; short: number | null }> {
  try {
    const { data: masters, error } = await supabase
      .from("photo_assets")
      .select("width,height,is_print_default,created_at")
      .eq("photo_id", photoId)
      .eq("variant", "print-master")
      .order("is_print_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { console.error("size-gate master lookup error:", error.message); return { long: null, short: null }; }
    const m = (masters ?? []).find((a: { width: number; height: number }) => a.width && a.height);
    if (m) return { long: Math.max(m.width, m.height), short: Math.min(m.width, m.height) };
  } catch (e) { console.error("masterDims threw:", String(e)); }
  return { long: null, short: null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const bodyIn = await req.json();
    const { successUrl, cancelUrl } = bodyIn;
    if (!successUrl || !cancelUrl) return json({ error: "successUrl and cancelUrl are required" }, 400);

    // Normalise input into a list of raw items (cart OR single).
    let rawItems: Array<{ photoId: unknown; sku: unknown; frameColor?: unknown; variant?: unknown; copies?: unknown }>;
    if (Array.isArray(bodyIn.items) && bodyIn.items.length) {
      rawItems = bodyIn.items;
    } else if (bodyIn.photoId && bodyIn.sku) {
      rawItems = [{ photoId: bodyIn.photoId, sku: bodyIn.sku, frameColor: bodyIn.frameColor, variant: bodyIn.variant, copies: bodyIn.copies ?? 1 }];
    } else {
      return json({ error: "Provide items[] or photoId + sku" }, 400);
    }
    if (rawItems.length > 30) return json({ error: "Too many items in one order." }, 400);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Validate every item + build normalised list.
    type Clean = { photoId: string | number; sku: string; frameColor: string | null; variant: string; copies: number; unitPrice: number; label: string; src: string; framed: boolean };
    const clean: Clean[] = [];
    let anyFramed = false;

    for (const raw of rawItems) {
      const photoId = raw.photoId as string | number;
      const skuUpper = String(raw.sku ?? "").toUpperCase();
      const copies = Math.max(1, Math.min(20, parseInt(String(raw.copies ?? 1), 10) || 1));
      if (!photoId || !skuUpper) return json({ error: "Each item needs photoId + sku" }, 400);

      const unitPrice = PRICES_CENTS[skuUpper];
      if (!unitPrice) return json({ error: `Unknown SKU: ${raw.sku}` }, 400);

      const variantClean = (raw.variant === "bordered" || raw.variant === "alt-crop") ? String(raw.variant) : "print-master";
      const framed = skuUpper.startsWith("GLOBAL-CFPM");
      if (framed) anyFramed = true;

      const { data: photo, error: photoErr } = await supabase
        .from("photos").select("id, src, for_sale").eq("id", photoId).single();
      if (photoErr || !photo) return json({ error: `Photo not found: ${photoId}` }, 404);
      if (!photo.for_sale) return json({ error: "A photo in your cart is not available for purchase." }, 403);

      const { long, short } = await masterDims(supabase, photoId);
      const gate = sizeAllowed(skuUpper, long, short);
      if (!gate.ok) {
        console.log("size-gate blocked:", JSON.stringify({ photoId, sku: skuUpper, long, short }));
        return json({ error: gate.reason ?? "A size in your cart isn’t available for that photo." }, 422);
      }

      const label = SKU_LABELS[skuUpper] ?? skuUpper;
      let description = raw.frameColor ? `${label} — ${raw.frameColor} frame` : label;
      if (variantClean === "bordered") description += " — white border";

      clean.push({
        photoId, sku: skuUpper, frameColor: (raw.frameColor as string) ?? null,
        variant: variantClean, copies, unitPrice, label: description, src: photo.src, framed,
      });
    }

    // Shipping countries: framed prints can't ship to Canada (uneconomic).
    const allCountries = ["US", "CA", "GB", "AU"];
    const allowedCountries = anyFramed ? allCountries.filter((c) => !FRAMED_BLOCKED_COUNTRIES.includes(c)) : allCountries;

    // Build the Stripe session (one line item per cart entry).
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", successUrl);
    params.append("cancel_url", cancelUrl);
    allowedCountries.forEach((c, i) => params.append(`shipping_address_collection[allowed_countries][${i}]`, c));

    params.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    params.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", "0");
    params.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
    params.append("shipping_options[0][shipping_rate_data][display_name]", "Free shipping");
    params.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
    params.append("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "5");
    params.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
    params.append("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "12");

    let amountTotal = 0;
    clean.forEach((it, i) => {
      amountTotal += it.unitPrice * it.copies;
      params.append(`line_items[${i}][price_data][currency]`, "usd");
      params.append(`line_items[${i}][price_data][unit_amount]`, String(it.unitPrice));
      params.append(`line_items[${i}][price_data][product_data][name]`, it.label);
      if (it.src) params.append(`line_items[${i}][price_data][product_data][images][0]`, it.src);
      params.append(`line_items[${i}][quantity]`, String(it.copies));
    });

    // metadata: keep legacy scalar keys for single orders (so an un-upgraded
    // webhook still fulfils them); the full list always lives in print_orders.items.
    params.append("metadata[order_kind]", clean.length > 1 ? "cart" : "single");
    params.append("metadata[item_count]", String(clean.length));
    if (clean.length === 1) {
      const it = clean[0];
      params.append("metadata[photo_id]", String(it.photoId));
      params.append("metadata[sku]", it.sku);
      params.append("metadata[frame_color]", it.frameColor ?? "");
      params.append("metadata[variant]", it.variant);
      params.append("metadata[copies]", String(it.copies));
    }

    const stripeResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const session = await stripeResp.json();
    if (!stripeResp.ok) return json({ error: "Stripe error", detail: session }, 502);

    // Persist a pending order. items[] is the source of truth for fulfilment.
    const first = clean[0];
    const itemsJson = clean.map((it) => ({
      photo_id: it.photoId, sku: it.sku, frame_color: it.frameColor, variant: it.variant, copies: it.copies,
    }));
    const totalCopies = clean.reduce((n, it) => n + it.copies, 0);
    const { error: insertErr } = await supabase.from("print_orders").insert({
      photo_id: first.photoId,
      sku: clean.length > 1 ? "MULTI" : first.sku,
      frame_color: clean.length > 1 ? null : first.frameColor,
      copies: totalCopies,
      stripe_session_id: session.id,
      status: "pending",
      amount_total: amountTotal,
      currency: "usd",
      items: itemsJson,
    });
    if (insertErr) console.error("Failed to insert print_order:", insertErr);

    return json({ url: session.url });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
