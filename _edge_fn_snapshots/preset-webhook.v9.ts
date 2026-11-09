import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// preset-webhook v9 (2026-11-09, unified Shop):
// - NEW: bundle orders. A session is a digital sale when metadata.kind = "pack" with an order_id
//   (create-digital-checkout) or metadata.digital = "1" (a print cart that also holds profiles /
//   presets, create-checkout-session v38). The preset_orders row (by session id) lists pack_ids.
//   One code per order; code_packs links it to every pack; the email links to the Shop downloads
//   page on stuartsingleton.com.
// - Legacy single-pack sales (kind=pack + pack_id, from the old presets storefront) take the v8
//   path unchanged: same code, same link, same email.
// Rollback: no v8 snapshot was saved; v8 = this file minus the bundle branch (legacy path is v8 verbatim).
// v5 notes still hold: ignores non-preset sessions, idempotent, secret REQUIRED.

const FROM_EMAIL = "prints@stuartsingleton.com";
const OWNER_EMAIL = "stuartssingleton@gmail.com";
const OLD_SITE = "https://stuarts-presets.stuartsingleton.com";
const SHOP_DOWNLOADS = "https://stuartsingleton.com/shop/downloads";
const MAX_UNLOCKS = 10;
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function verifyStripeSignature(body: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(",").reduce((acc: Record<string, string[]>, part) => {
    const i = part.indexOf("=");
    if (i > 0) (acc[part.slice(0, i)] ??= []).push(part.slice(i + 1));
    return acc;
  }, {});
  const timestamp = parts["t"]?.[0];
  const sigs = parts["v1"] ?? [];
  if (!timestamp || !sigs.length) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const computed = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.includes(computed);
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !to) { console.log("sendEmail skipped:", subject); return false; }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `Stuart Singleton <${FROM_EMAIL}>`, to: [to], subject, html }),
    });
    if (!resp.ok) { console.error("Resend send failed:", resp.status, (await resp.text()).slice(0, 500)); return false; }
    return true;
  } catch (e) { console.error("Resend send threw:", String(e)); return false; }
}

function money(cents: number | null | undefined, currency: string): string {
  if (cents == null) return "";
  return `${(cents / 100).toFixed(2)} ${(currency || "usd").toUpperCase()}`;
}
function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "SP-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

type Pack = { id: string; name: string; slug: string; kind: string; files: number };

function buyerEmailHtml(o: { title: string; packs: Pack[]; code: string; link: string; total: string; hasProfiles: boolean; hasPresets: boolean }): string {
  const list = o.packs.map((p) => `<li style="margin:2px 0">${esc(p.name)}${p.kind === "profile" ? " <span style=\"color:#999\">(Halation profile, 4 looks)</span>" : ""}</li>`).join("");
  const ig = o.hasProfiles && !o.hasPresets ? "halation.camera" : "stuartsingleton.jpg";
  const tag = o.hasProfiles ? " and <strong>#shotonhalation</strong>" : "";
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
    <h2 style="font-weight:600;letter-spacing:.02em">${esc(o.title)}</h2>
    <p>Thanks for your order. Everything below is ready to download:</p>
    <ul style="font-size:14px;color:#333;padding-left:18px">${list}</ul>
    <p style="margin:22px 0"><a href="${o.link}" style="background:#1a1a1a;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-size:15px;letter-spacing:.03em;display:inline-block">Get your downloads</a></p>
    <p style="font-size:13px;color:#666">This link doesn't expire, so keep this email. Your code is <strong style="font-family:Menlo,monospace;color:#1a1a1a;letter-spacing:.08em">${o.code}</strong> (enter it at <a href="${SHOP_DOWNLOADS}" style="color:#666">stuartsingleton.com/shop/downloads</a>).</p>
    ${o.hasProfiles ? `<p style="font-size:13px;color:#666"><strong style="color:#1a1a1a">Profiles:</strong> Lightroom desktop → File → Import Develop Profiles and Presets → pick the files in <em>Profiles/</em>. They show up in the Profile Browser under Halation. On mobile, import the files in <em>Presets/</em>. The .cube LUTs work in Premiere, Resolve, Final Cut and Photoshop.</p>` : ""}
    ${o.hasPresets ? `<p style="font-size:13px;color:#666"><strong style="color:#1a1a1a">Presets:</strong> Lightroom desktop → File → Import Develop Profiles and Presets → pick the .xmp files. Lightroom mobile → Presets → ⋯ → Import Presets.</p>` : ""}
    <div style="border-top:1px solid #eee;margin-top:22px;padding-top:16px;font-size:14px">
      <p style="margin:0 0 6px"><strong>Show me what you make.</strong></p>
      <p style="margin:0;color:#444">Post something you edited and tag <a href="https://instagram.com/${ig}" style="color:#1a1a1a">@${ig}</a>${tag}. If I share it, I'll send you a code for another one, on me.</p>
    </div>
    <table style="font-size:13px;line-height:1.9;margin-top:18px;color:#666"><tr><td style="padding-right:18px">Total</td><td>${o.total}</td></tr></table>
    <p style="font-size:12px;color:#aaa;margin-top:20px">Stuart Singleton · License: use them on any of your own photos, including paid client work. Please don't resell or share the files.</p>
  </div>`;
}

function legacyBuyerEmailHtml(o: { packName: string; code: string; link: string; files: string[]; total: string }): string {
  const fileList = o.files.map((f) => `<li style="margin:2px 0">${esc(f)}</li>`).join("");
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
    <h2 style="font-weight:600;letter-spacing:.02em">Your presets are ready</h2>
    <p>Thanks for picking up <strong>${esc(o.packName)}</strong>. One tap and they're yours:</p>
    <p style="margin:22px 0"><a href="${o.link}" style="background:#1a1a1a;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-size:15px;letter-spacing:.03em;display:inline-block">Download your presets</a></p>
    <p style="font-size:13px;color:#666">This link doesn't expire, so keep this email. If you ever need it, your code is <strong style="font-family:Menlo,monospace;color:#1a1a1a;letter-spacing:.08em">${o.code}</strong> (redeem it on <a href="${OLD_SITE}" style="color:#666">${OLD_SITE.replace("https://", "")}</a>).</p>
    ${fileList ? `<p style="font-size:13px;color:#666;margin-bottom:4px">In this pack:</p><ul style="font-size:13px;color:#444;padding-left:18px;margin-top:0">${fileList}</ul>` : ""}
    <p style="font-size:13px;color:#666"><strong style="color:#1a1a1a">Install:</strong> Lightroom desktop → File → Import Develop Profiles and Presets → pick the .xmp files. Lightroom mobile → Presets → ⋯ → Import Presets. If you use Lightroom (not Classic), presets you import on desktop also sync to your phone.</p>
    <div style="border-top:1px solid #eee;margin-top:22px;padding-top:16px;font-size:14px">
      <p style="margin:0 0 6px"><strong>Show me what you make.</strong></p>
      <p style="margin:0;color:#444">Post something you edited with it and tag <a href="https://instagram.com/stuartsingleton.jpg" style="color:#1a1a1a">@stuartsingleton.jpg</a> on Instagram. If I share it, I'll send you a code for another pack, on me.</p>
    </div>
    <table style="font-size:13px;line-height:1.9;margin-top:18px;color:#666"><tr><td style="padding-right:18px">Total</td><td>${o.total}</td></tr></table>
    <p style="font-size:12px;color:#aaa;margin-top:20px">Stuart Singleton · License: use them on any of your own photos, including paid client work. Please don't resell or share the preset files.</p>
  </div>`;
}

function ownerEmailHtml(o: { packs: string; email: string; total: string; fileCount: number; code: string; link: string; src?: string | null; note?: string }): string {
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;color:#1a1a1a">
    <h2 style="font-weight:600">${o.note ? "⚠️ " : ""}New digital sale 🎞️</h2>
    ${o.note ? `<p style="color:#b00">${o.note}</p>` : ""}
    <table style="font-size:14px;line-height:1.9">
      <tr><td style="color:#888;padding-right:18px">Packs</td><td>${esc(o.packs)}</td></tr>
      <tr><td style="color:#888;padding-right:18px">Total</td><td>${o.total}</td></tr>
      <tr><td style="color:#888;padding-right:18px">Files</td><td>${o.fileCount}</td></tr>
      <tr><td style="color:#888;padding-right:18px">Buyer</td><td>${esc(o.email || "")}</td></tr>
      ${o.src ? `<tr><td style="color:#888;padding-right:18px">Source</td><td>${esc(o.src)}</td></tr>` : ""}
      <tr><td style="color:#888;padding-right:18px">Code</td><td style="font-family:Menlo,monospace">${o.code}</td></tr>
      <tr><td style="color:#888;padding-right:18px">Link</td><td><a href="${o.link}">${o.link}</a></td></tr>
    </table>
  </div>`;
}

Deno.serve(async (req: Request) => {
  const body = await req.text();
  const secret = Deno.env.get("STRIPE_PRESET_WEBHOOK_SECRET") ?? "";
  if (!secret) { console.error("STRIPE_PRESET_WEBHOOK_SECRET is not set; refusing to process"); return new Response("Webhook not configured", { status: 500 }); }
  if (!(await verifyStripeSignature(body, req.headers.get("stripe-signature") ?? "", secret))) return new Response("Invalid signature", { status: 400 });

  let event: Record<string, unknown>;
  try { event = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (event.type !== "checkout.session.completed") return json({ received: true });

  const s = (event.data as Record<string, unknown>).object as Record<string, unknown>;
  const metadata = (s.metadata as Record<string, string>) ?? {};
  const isBundle = (metadata.kind === "pack" && !!metadata.order_id) || metadata.digital === "1";
  const isLegacy = !isBundle && metadata.kind === "pack" && !!metadata.pack_id;
  if (!isBundle && !isLegacy) return json({ received: true, ignored: "not a digital sale" });

  const paymentStatus = s.payment_status as string;
  if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") return json({ received: true, ignored: `payment_status=${paymentStatus}` });

  const sessionId = s.id as string;
  const customerEmail = (s.customer_details as Record<string, string> | null)?.email ?? null;
  const amountTotal = (s.amount_total as number) ?? null;
  const currency = (s.currency as string) ?? "usd";
  const conv = s.currency_conversion as { amount_total?: number; source_currency?: string } | undefined;
  const total = money(amountTotal, currency) +
    (conv?.amount_total != null && conv.source_currency && conv.source_currency !== currency ? ` (${money(conv.amount_total, conv.source_currency)})` : "");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: existing } = await supabase.from("preset_orders").select("id, status, access_code, pack_id, pack_ids, src, amount_total").eq("stripe_session_id", sessionId).maybeSingle();
  if (existing?.access_code && (existing.status === "delivered" || existing.status === "error")) return json({ received: true, duplicate: true });

  let packIds: string[];
  if (isBundle) {
    if (!existing?.pack_ids?.length) {
      // Checkout refuses to hand out a URL without this row, so this should never happen. Retry, and tell Stuart.
      await sendEmail(OWNER_EMAIL, "⚠️ Digital sale PAID but its order row is missing",
        `<p>Session ${sessionId} was paid by ${esc(customerEmail || "?")} but preset_orders has no pack list for it. Check Stripe for what they bought and send a code from /admin.</p>`);
      return new Response("order row missing", { status: 500 });
    }
    packIds = existing.pack_ids as string[];
  } else {
    packIds = [metadata.pack_id];
    if (!existing) {
      await supabase.from("preset_orders").insert({ kind: "pack", pack_id: metadata.pack_id, stripe_session_id: sessionId, status: "pending", amount_total: amountTotal, currency });
    }
  }

  const { data: packRows } = await supabase.from("packs").select("id,name,slug,kind,sort_order,pack_files(file_name)").in("id", packIds);
  // deno-lint-ignore no-explicit-any
  const packs: (Pack & { fileNames: string[] })[] = (packRows ?? []).map((p: any) => ({
    id: p.id, name: p.name, slug: p.slug, kind: p.kind, files: (p.pack_files ?? []).length,
    fileNames: (p.pack_files ?? []).map((f: { file_name: string }) => f.file_name).sort(),
  })).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "profile" ? -1 : 1));
  const packNames = packs.map((p) => p.name).join(", ") || "Stuart's Presets";

  let code = existing?.access_code ?? null;
  let codeId: string | null = null;
  if (!code) {
    for (let i = 0; i < 5 && !code; i++) {
      const candidate = newCode();
      const { data: row, error } = await supabase.from("codes").insert({
        code: candidate, pack_id: packIds[0], is_bundle: false, max_redemptions: MAX_UNLOCKS, source: "purchase",
      }).select("id").single();
      if (!error && row) { code = candidate; codeId = row.id; } else console.error("code insert failed, retrying:", error?.message);
    }
  } else {
    const { data: row } = await supabase.from("codes").select("id").eq("code", code).maybeSingle();
    codeId = row?.id ?? null;
  }
  if (!code) {
    await supabase.from("preset_orders").update({ status: "error", error_detail: "code_generation_failed", customer_email: customerEmail }).eq("stripe_session_id", sessionId);
    await sendEmail(OWNER_EMAIL, "⚠️ Digital sale PAID but code generation FAILED",
      `<p>Session ${sessionId} (${esc(packNames)}) was paid by ${esc(customerEmail || "?")} but no unlock code could be created. Generate one in /admin and send it by hand.</p>`);
    return new Response("code generation failed", { status: 500 });
  }
  if (isBundle && codeId) {
    const { error: cpErr } = await supabase.from("code_packs").upsert(packIds.map((pack_id) => ({ code_id: codeId, pack_id })), { onConflict: "code_id,pack_id", ignoreDuplicates: true });
    if (cpErr) {
      console.error("code_packs insert failed:", cpErr.message);
      await supabase.from("preset_orders").update({ access_code: code, error_detail: "code_packs_failed", customer_email: customerEmail }).eq("stripe_session_id", sessionId);
      return new Response("code_packs failed", { status: 500 }); // retry reuses the same code
    }
  }

  const link = isBundle ? `${SHOP_DOWNLOADS}?code=${code}` : `${OLD_SITE}/preset/${packs[0]?.slug ?? ""}?code=${code}`;
  const emptyPacks = packs.filter((p) => p.files === 0).map((p) => p.name);
  const fileCount = packs.reduce((n, p) => n + p.files, 0);
  const hasError = emptyPacks.length > 0 || packs.length !== packIds.length;

  await supabase.from("preset_orders").update({
    status: hasError ? "error" : "delivered",
    error_detail: hasError ? (emptyPacks.length ? `no_files: ${emptyPacks.join(", ")}`.slice(0, 500) : "pack_missing") : null,
    access_code: code, customer_email: customerEmail, stripe_payment_intent: (s.payment_intent as string) ?? null,
    ...(isBundle ? {} : { amount_total: amountTotal }), currency: isBundle ? "usd" : currency,
  }).eq("stripe_session_id", sessionId);

  const src = existing?.src ?? metadata.src ?? null;
  if (hasError) {
    await sendEmail(OWNER_EMAIL, "⚠️ Digital sale PAID but a pack has NO FILES",
      ownerEmailHtml({ packs: packNames, email: customerEmail ?? "", total, fileCount, code, link, src,
        note: `The buyer was NOT emailed. Missing files: ${esc(emptyPacks.join(", ") || "a pack was deleted")}. Fix it in /admin, then forward them the link below.` }));
    return json({ received: true, warning: "no_files" });
  }

  if (customerEmail) {
    const hasProfiles = packs.some((p) => p.kind === "profile");
    const hasPresets = packs.some((p) => p.kind !== "profile");
    const ok = isBundle
      ? await sendEmail(customerEmail, hasProfiles && !hasPresets ? "Your Halation profiles are ready" : "Your downloads are ready",
          buyerEmailHtml({ title: hasProfiles && !hasPresets ? "Your Halation profiles are ready" : "Your downloads are ready", packs, code, link, total, hasProfiles, hasPresets }))
      : await sendEmail(customerEmail, `Your presets are ready: ${packNames}`, legacyBuyerEmailHtml({ packName: packNames, code, link, files: packs[0]?.fileNames ?? [], total }));
    if (!ok) await supabase.from("preset_orders").update({ error_detail: "buyer_email_failed" }).eq("stripe_session_id", sessionId);
  }
  await sendEmail(OWNER_EMAIL, `New digital sale: ${packNames.slice(0, 80)} (${total})`, ownerEmailHtml({ packs: packNames, email: customerEmail ?? "", total, fileCount, code, link, src }));
  return json({ received: true });
});
