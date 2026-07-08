import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ─────────────────────────────────────────────────────────────────────────────
// stripe-webhook v23 — MULTI-ITEM fulfilment + backward-compatible single item
//
// On checkout.session.completed it loads the print_orders row for the session.
// If print_orders.items is present (written by create-checkout-session v24+),
// EVERY item is fulfilled as a line in ONE Prodigi order. If items is absent
// (an order placed by the old single-item flow), it falls back to reading the
// single item from Stripe session metadata exactly as v22 did. Each item's
// print asset is resolved per its chosen variant (signed private URL → master →
// public preview). Emails summarise all lines. Fulfilment never throws on email.
// ─────────────────────────────────────────────────────────────────────────────

const PRODIGI_BASE = "https://api.prodigi.com/v4.0";
const FROM_EMAIL = "prints@stuartsingleton.com";
const OWNER_EMAIL = "stuartssingleton@gmail.com";
const MASTER_SIGNED_URL_TTL = 86400;

async function verifyStripeSignature(body: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(",").reduce((acc: Record<string, string>, part) => {
    const [k, v] = part.split("="); acc[k] = v; return acc;
  }, {});
  const timestamp = parts["t"]; const sig = parts["v1"];
  if (!timestamp || !sig) return false;
  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(signatureBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === sig;
}

function resolveShipping(session: Record<string, unknown>): { name: string | null; address: Record<string, string> | null } {
  const ci = session.collected_information as Record<string, unknown> | undefined;
  const candidates = [
    session.shipping_details as Record<string, unknown> | undefined,
    ci?.shipping_details as Record<string, unknown> | undefined,
    session.shipping as Record<string, unknown> | undefined,
    session.customer_details as Record<string, unknown> | undefined,
  ];
  for (const c of candidates) {
    if (c && c.address) return { name: (c.name as string) ?? null, address: c.address as Record<string, string> };
  }
  return { name: null, address: null };
}

// deno-lint-ignore no-explicit-any
async function resolvePrintAsset(supabase: any, photoId: number | string, publicSrc: string, wantVariant: string): Promise<{ url: string; usedVariant: string }> {
  const order = wantVariant === "print-master" ? ["print-master"] : [wantVariant, "print-master"];
  for (const v of order) {
    try {
      const { data: assets, error } = await supabase
        .from("photo_assets").select("variant,bucket,path,is_print_default,created_at")
        .eq("photo_id", photoId).eq("variant", v)
        .order("is_print_default", { ascending: false }).order("created_at", { ascending: false });
      if (error) { console.error(`resolvePrintAsset(${v}) query error:`, error.message); continue; }
      const a = (assets ?? [])[0] as { bucket: string | null; path: string | null } | undefined;
      if (!a || !a.bucket || !a.path) continue;
      const { data: signed, error: signErr } = await supabase.storage.from(a.bucket as string).createSignedUrl(a.path as string, MASTER_SIGNED_URL_TTL);
      if (signErr || !signed?.signedUrl) { console.error(`resolvePrintAsset(${v}) sign error:`, signErr?.message ?? "no signed url"); continue; }
      return { url: signed.signedUrl, usedVariant: v };
    } catch (e) { console.error(`resolvePrintAsset(${v}) threw:`, String(e)); }
  }
  return { url: publicSrc, usedVariant: "public-preview" };
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !to) { console.log("sendEmail skipped:", subject); return; }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `Stuart Singleton <${FROM_EMAIL}>`, to: [to], subject, html }),
    });
    if (!resp.ok) console.error("Resend send failed:", resp.status, (await resp.text()).slice(0, 500));
  } catch (e) { console.error("Resend send threw:", String(e)); }
}

function money(cents: number | null | undefined, currency: string): string {
  if (cents == null) return "";
  return `${(cents / 100).toFixed(2)} ${(currency || "usd").toUpperCase()}`;
}
function skuLabel(sku: string): string {
  const size = sku.replace(/^GLOBAL-(FAP|CFPM(-MOTH)?)-/, "").replace("X", "×");
  const framed = sku.startsWith("GLOBAL-CFPM") ? " framed" : "";
  return `${size}${framed}`;
}

type OrderItem = { photo_id: number | string; sku: string; frame_color: string | null; variant: string; copies: number };

function buyerEmailHtml(opts: { name: string; items: OrderItem[]; total: string; orderId: string | null; heroSrc: string }): string {
  const rows = opts.items.map((it) =>
    `<tr><td style="color:#888;padding:2px 18px 2px 0">${skuLabel(it.sku)}</td><td>× ${it.copies}</td></tr>`).join("");
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
    <h2 style="font-weight:600;letter-spacing:.02em">Your prints are on the way</h2>
    <p>Thanks ${opts.name || ""} — your order is confirmed and headed into production.</p>
    ${opts.heroSrc ? `<img src="${opts.heroSrc}" alt="" style="width:100%;max-width:360px;border:1px solid #e7e4dd;margin:14px 0"/>` : ""}
    <table style="font-size:14px;line-height:1.9">${rows}
      <tr><td style="color:#888;padding:2px 18px 2px 0">Total</td><td>${opts.total}</td></tr>
      ${opts.orderId ? `<tr><td style="color:#888;padding:2px 18px 2px 0">Order</td><td>${opts.orderId}</td></tr>` : ""}
    </table>
    <p style="font-size:13px;color:#666">Produced and shipped by our fulfillment partner. You'll get tracking once it's dispatched. Fine-art prints typically arrive within 5–10 business days.</p>
    <p style="font-size:12px;color:#aaa;margin-top:24px">Stuart Singleton · stuartsingleton.com</p>
  </div>`;
}

function ownerEmailHtml(opts: { name: string; email: string; items: Array<OrderItem & { usedVariant: string }>; total: string; orderId: string | null; address: Record<string, string> }): string {
  const a = opts.address;
  const rows = opts.items.map((it) => {
    const asset = it.usedVariant === "public-preview" ? "web preview (no master)" : `${it.usedVariant} ✓`;
    return `<tr><td style="color:#888;padding:2px 16px 2px 0">${it.sku}${it.frame_color ? " / " + it.frame_color : ""}</td><td>× ${it.copies}</td><td style="color:#888">${asset}</td></tr>`;
  }).join("");
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;color:#1a1a1a">
    <h2 style="font-weight:600">New print order 📦 (${opts.items.length} item${opts.items.length > 1 ? "s" : ""})</h2>
    <table style="font-size:14px;line-height:1.9">${rows}</table>
    <table style="font-size:14px;line-height:1.9;margin-top:10px">
      <tr><td style="color:#888;padding-right:18px">Total</td><td>${opts.total}</td></tr>
      <tr><td style="color:#888;padding-right:18px">Prodigi</td><td>${opts.orderId || "(see dashboard)"}</td></tr>
      <tr><td style="color:#888;padding-right:18px">Customer</td><td>${opts.name || ""} &lt;${opts.email || ""}&gt;</td></tr>
      <tr><td style="color:#888;padding-right:18px">Ship to</td><td>${[a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(", ")}</td></tr>
    </table>
  </div>`;
}

Deno.serve(async (req: Request) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  if (webhookSecret) {
    const valid = await verifyStripeSignature(body, sig, webhookSecret);
    if (!valid) return new Response("Invalid signature", { status: 400 });
  }

  let event: Record<string, unknown>;
  try { event = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }

  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  }

  const dataObj = event.data as Record<string, unknown>;
  const sessionObj = dataObj.object as Record<string, unknown>;
  const metadata = (sessionObj.metadata as Record<string, string>) ?? {};
  const sessionId = sessionObj.id as string;
  const paymentIntent = sessionObj.payment_intent as string;
  const customerEmail = sessionObj.customer_details ? (sessionObj.customer_details as Record<string, string>).email : null;
  const amountTotal = (sessionObj.amount_total as number) ?? null;
  const currency = (sessionObj.currency as string) ?? "usd";

  const { name: shipName, address: shippingAddr } = resolveShipping(sessionObj);
  console.log("shipping resolved:", JSON.stringify({ shipName, shippingAddr }));

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Mark paid + capture shipping.
  await supabase.from("print_orders").update({
    status: "paid", stripe_payment_intent: paymentIntent, customer_email: customerEmail,
    shipping_address: shippingAddr ?? null, shipping_name: shipName,
  }).eq("stripe_session_id", sessionId);

  if (!shippingAddr || !shippingAddr.line1) {
    console.error("No shipping address on session", sessionId);
    await supabase.from("print_orders").update({ status: "error", error_detail: "no_shipping_address" }).eq("stripe_session_id", sessionId);
    return new Response(JSON.stringify({ received: true, warning: "no_shipping_address" }), { headers: { "Content-Type": "application/json" } });
  }

  // Determine the item list: prefer print_orders.items (cart/new), else fall
  // back to the single item from Stripe metadata (legacy path).
  const { data: orderRow } = await supabase.from("print_orders").select("items").eq("stripe_session_id", sessionId).single();
  let items: OrderItem[] = [];
  if (orderRow?.items && Array.isArray(orderRow.items) && orderRow.items.length) {
    items = orderRow.items.map((it: Record<string, unknown>) => ({
      photo_id: it.photo_id as number, sku: it.sku as string, frame_color: (it.frame_color as string) ?? null,
      variant: (it.variant as string) ?? "print-master", copies: parseInt(String(it.copies ?? 1), 10) || 1,
    }));
  } else {
    const rawVariant = metadata.variant;
    items = [{
      photo_id: parseInt(metadata.photo_id), sku: metadata.sku, frame_color: metadata.frame_color || null,
      variant: (rawVariant === "bordered" || rawVariant === "alt-crop") ? rawVariant : "print-master",
      copies: parseInt(metadata.copies ?? "1"),
    }];
  }

  // Build one Prodigi order with a line per item; resolve each print asset.
  const prodigiItems: Array<Record<string, unknown>> = [];
  const emailItems: Array<OrderItem & { usedVariant: string }> = [];
  let heroSrc = "";
  for (const it of items) {
    const { data: photo } = await supabase.from("photos").select("src").eq("id", it.photo_id).single();
    const publicSrc = photo?.src ?? "";
    if (!heroSrc && publicSrc) heroSrc = publicSrc;
    const { url: printUrl, usedVariant } = await resolvePrintAsset(supabase, it.photo_id, publicSrc, it.variant);
    const isFramed = it.sku.startsWith("GLOBAL-CFPM");
    const attributes = isFramed ? { color: it.frame_color ?? "black" } : { paperType: "EMA" };
    prodigiItems.push({
      merchantReference: `item-${sessionId}-${prodigiItems.length}`,
      sku: it.sku, copies: it.copies, sizing: "fillPrintArea", attributes,
      assets: [{ printArea: "default", url: printUrl }],
    });
    emailItems.push({ ...it, usedVariant });
  }

  const address: Record<string, string> = {
    line1: shippingAddr.line1 ?? "", postalOrZipCode: shippingAddr.postal_code ?? "",
    countryCode: shippingAddr.country ?? "US", townOrCity: shippingAddr.city ?? "",
  };
  if (shippingAddr.line2 && shippingAddr.line2.trim()) address.line2 = shippingAddr.line2.trim();
  if (shippingAddr.state && shippingAddr.state.trim()) address.stateOrCounty = shippingAddr.state.trim();

  const prodigiOrder = {
    merchantReference: sessionId,
    shippingMethod: "Standard",
    recipient: { name: shipName ?? customerEmail ?? "Customer", email: customerEmail ?? "", address },
    items: prodigiItems,
  };

  const apiKey = Deno.env.get("PRODIGI_API_KEY")!;
  const prodigiResp = await fetch(`${PRODIGI_BASE}/orders`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(prodigiOrder),
  });
  const prodigiData = await prodigiResp.json();

  if (!prodigiResp.ok) {
    console.error("Prodigi order failed:", JSON.stringify(prodigiData));
    await supabase.from("print_orders").update({ status: "error", error_detail: JSON.stringify(prodigiData).slice(0, 2000) }).eq("stripe_session_id", sessionId);
    await sendEmail(OWNER_EMAIL, "⚠️ Print order PAID but Prodigi FAILED",
      `<p>Session ${sessionId} was paid but Prodigi rejected the order.</p><pre style="font-size:12px;white-space:pre-wrap">${JSON.stringify(prodigiData).slice(0, 1400)}</pre>`);
  } else {
    const orderId = prodigiData.order?.id ?? prodigiData.id ?? null;
    await supabase.from("print_orders").update({ status: "submitted", prodigi_order_id: orderId, error_detail: null }).eq("stripe_session_id", sessionId);
    const total = money(amountTotal, currency);
    if (customerEmail) {
      await sendEmail(customerEmail, "Your prints are on the way — Stuart Singleton",
        buyerEmailHtml({ name: shipName ?? "", items, total, orderId, heroSrc }));
    }
    await sendEmail(OWNER_EMAIL, `New print order — ${total}`,
      ownerEmailHtml({ name: shipName ?? "", email: customerEmail ?? "", items: emailItems, total, orderId, address: shippingAddr }));
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
