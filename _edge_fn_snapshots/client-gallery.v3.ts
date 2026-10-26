import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

// client-gallery v3 (2026-10-26): ADMIN PREVIEW. body.preview=true + an admin's Supabase JWT in
//   Authorization opens the gallery even while it's a draft (or expired). Preview is read-only: only
//   view/quote run; unlock/checkout/claim/download refuse with 403. Each photo also carries a signed
//   `clean` URL so the page can simulate unlocking on screen. Without preview=true nothing changes:
//   a draft is still the same 404 for everyone, including Stuart.
// client-gallery v2 (2026-10-20): unlocked photos use the clean preview in the grid too.
// client-gallery v1 (2026-10-20, Shop v2 Phase 2) — the ONLY public door into a client gallery.
// Every request carries slug + code; nothing is served without both. Tables and the
// `client-galleries` bucket are admin-only under RLS, so this function (service role) is the gate.
//
// actions:
//   view      → gallery meta, allowance, photos with signed URLs (watermarked proof while locked,
//               clean preview once unlocked). Also reconciles pending extra-unlock orders with Stripe,
//               so a buyer who closed the tab before returning still gets their credits.
//   unlock    → spend allowance on photo ids (atomic RPC client_gallery_unlock, per-gallery lock).
//   download  → short-lived signed URLs for UNLOCKED masters only.
//   checkout  → Stripe Checkout for extra unlocks (metadata.kind = "gallery"; both existing
//               webhooks ignore that kind). The chosen photos ride on the order row.
//   claim     → on return from Stripe: verify the session with Stripe, mark paid once, unlock.
// verify_jwt: false (public). Decision 241: client photos are never public, never in feeds.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const VIEW_TTL = 3600;       // proof/preview URLs: 1 hour (page re-fetches on focus after that)
const DOWNLOAD_TTL = 900;    // master download URLs: 15 minutes
const BUCKET = "client-galleries";
const SITE = "https://stuartsingleton.com";

type Gallery = {
  id: string; slug: string; access_code: string; title: string; client_name: string | null;
  shoot_date: string | null; included_unlocks: number; bonus_unlocks: number;
  extra_unlock_cents: number; bundle_size: number; bundle_cents: number;
  expires_at: string | null; is_active: boolean;
};

function sameCode(a: string, b: string): boolean {
  const x = a.trim().toUpperCase(), y = b.trim().toUpperCase();
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return d === 0;
}

// Price for n extra credits, and how many credits that actually buys. Bundles of B at a flat
// price; leftovers at the single price but never more than a bundle (then you get the bundle).
export function priceCredits(n: number, g: Pick<Gallery, "extra_unlock_cents" | "bundle_size" | "bundle_cents">) {
  const B = g.bundle_size, each = g.extra_unlock_cents, bundle = g.bundle_cents;
  const full = Math.floor(n / B), rest = n % B;
  const restCost = rest * each;
  if (rest && restCost >= bundle) return { credits: (full + 1) * B, cents: (full + 1) * bundle };
  return { credits: n, cents: full * bundle + restCost };
}

// True only for a valid, unexpired Supabase session whose user has the admin role.
async function isAdmin(sb: SupabaseClient, req: Request): Promise<boolean> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token.split(".").length !== 3) return false;
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return false;
    const { data: role } = await sb.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    return !!role;
  } catch { return false; }
}

async function loadGallery(sb: SupabaseClient, slug: unknown, code: unknown, preview: boolean): Promise<Gallery | Response> {
  if (typeof slug !== "string" || typeof code !== "string" || !slug || !code) return json({ error: "not found" }, 404);
  const { data } = await sb.from("client_galleries").select("*").eq("slug", slug.toLowerCase()).maybeSingle();
  // Same 404 for wrong slug, wrong code, or unpublished: nothing to enumerate. Admin preview skips is_active.
  if (!data || (!data.is_active && !preview) || !sameCode(code, data.access_code)) return json({ error: "not found" }, 404);
  return data as Gallery;
}

const expired = (g: Gallery) => !!g.expires_at && new Date(g.expires_at).getTime() < Date.now();

async function allowance(sb: SupabaseClient, g: Gallery) {
  const { data: paid } = await sb.from("client_gallery_orders").select("credits").eq("gallery_id", g.id).eq("status", "paid");
  const purchased = (paid ?? []).reduce((n: number, o: { credits: number }) => n + o.credits, 0);
  const { count } = await sb.from("client_gallery_unlocks").select("id", { count: "exact", head: true })
    .eq("gallery_id", g.id).eq("source", "allowance");
  const total = g.included_unlocks + g.bonus_unlocks + purchased;
  const used = count ?? 0;
  return { included: g.included_unlocks, bonus: g.bonus_unlocks, purchased, total, used, remaining: Math.max(0, total - used) };
}

async function stripeSession(id: string) {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const s = await r.json();
  if (!r.ok) throw new Error(`stripe ${r.status}: ${JSON.stringify(s).slice(0, 300)}`);
  return s as Record<string, unknown>;
}

// Mark an order paid exactly once (pending → paid), then spend its credits on its chosen photos.
async function settleOrder(sb: SupabaseClient, g: Gallery, order: { id: string; stripe_session_id: string; photo_ids: string[] }) {
  const s = await stripeSession(order.stripe_session_id);
  const meta = (s.metadata as Record<string, string>) ?? {};
  if (meta.kind !== "gallery" || meta.gallery_id !== g.id) return { status: "mismatch" };
  const ps = s.payment_status as string;
  if (ps === "paid" || ps === "no_payment_required") {
    const email = (s.customer_details as Record<string, string> | null)?.email ?? null;
    const { data: claimed } = await sb.from("client_gallery_orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), customer_email: email })
      .eq("id", order.id).eq("status", "pending").select("id");
    if (claimed && claimed.length) {
      if (order.photo_ids?.length) {
        const { data: res } = await sb.rpc("client_gallery_unlock", { p_gallery: g.id, p_photos: order.photo_ids, p_order: order.id });
        console.log("gallery order settled", order.id, JSON.stringify(res));
      }
      notifyOwner(g, s, order).catch(() => {});
    }
    return { status: "paid" };
  }
  if (s.status === "expired") {
    await sb.from("client_gallery_orders").update({ status: "expired" }).eq("id", order.id).eq("status", "pending");
    return { status: "expired" };
  }
  return { status: "pending" };
}

async function notifyOwner(g: Gallery, s: Record<string, unknown>, order: { id: string }) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  const total = ((s.amount_total as number) ?? 0) / 100;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Stuart Singleton <prints@stuartsingleton.com>",
      to: ["stuartssingleton@gmail.com"],
      subject: `Gallery extras: ${g.client_name ?? g.slug} ($${total.toFixed(2)})`,
      html: `<p>${g.client_name ?? g.slug} bought extra photos in <b>${g.title}</b>.</p><p>Total: $${total.toFixed(2)}<br>Order: ${order.id}<br>Gallery: ${SITE}/g/${g.slug}</p>`,
    }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let preview = false;
  if (body.preview === true) {
    if (!(await isAdmin(sb, req))) return json({ error: "preview needs admin sign-in", preview_denied: true }, 401);
    preview = true;
  }
  const gOrRes = await loadGallery(sb, body.slug, body.code, preview);
  if (gOrRes instanceof Response) return gOrRes;
  const g = gOrRes;
  const action = String(body.action ?? "view");

  try {
    if (preview && action !== "view" && action !== "quote") return json({ error: "off in preview", preview: true }, 403);
    if (expired(g) && action !== "view") return json({ error: "expired" }, 410);

    // ── VIEW ──
    if (action === "view") {
      const firstName = (g.client_name ?? "").trim().split(/\s+/)[0] || null;
      const base = {
        title: g.title, client: firstName, shoot_date: g.shoot_date, expires_at: g.expires_at,
        pricing: { each_cents: g.extra_unlock_cents, bundle_size: g.bundle_size, bundle_cents: g.bundle_cents },
      };
      if (expired(g) && !preview) return json({ ...base, expired: true, photos: [] }, 410);

      // Reconcile recent pending orders (tab closed before returning from Stripe). Not in preview.
      const since = new Date(Date.now() - 3 * 86400_000).toISOString();
      const { data: pending } = await sb.from("client_gallery_orders").select("id,stripe_session_id,photo_ids")
        .eq("gallery_id", g.id).eq("status", "pending").gte("created_at", since).not("stripe_session_id", "is", null).limit(5);
      for (const o of preview ? [] : pending ?? []) { try { await settleOrder(sb, g, o); } catch (e) { console.error("reconcile", o.id, String(e)); } }

      const { data: photos } = await sb.from("client_gallery_photos")
        .select("id,position,filename,width,height,preview_path,thumb_path,clean_path")
        .eq("gallery_id", g.id).order("position").order("created_at");
      const { data: unl } = await sb.from("client_gallery_unlocks").select("photo_id").eq("gallery_id", g.id);
      const unlocked = new Set((unl ?? []).map((u: { photo_id: string }) => u.photo_id));
      const list = photos ?? [];
      // Locked: watermarked thumb + watermarked proof. Unlocked: the clean preview for both.
      const paths: string[] = [];
      for (const p of list) {
        const clean = unlocked.has(p.id) && p.clean_path;
        paths.push(clean ? p.clean_path : p.thumb_path);
        paths.push(clean ? p.clean_path : p.preview_path);
      }
      // Preview only: a third URL per photo, the clean preview, so the page can simulate unlocking.
      if (preview) for (const p of list) paths.push(p.clean_path ?? p.preview_path);
      const signed = paths.length ? (await sb.storage.from(BUCKET).createSignedUrls(paths, VIEW_TTL)).data ?? [] : [];
      const url = (i: number) => (signed[i] as { signedUrl?: string } | undefined)?.signedUrl ?? null;
      return json({
        ...base,
        ...(preview ? { preview: true, is_active: g.is_active, expired: expired(g) } : {}),
        allowance: await allowance(sb, g),
        photos: list.map((p, i) => ({
          id: p.id, n: i + 1, w: p.width, h: p.height, unlocked: unlocked.has(p.id),
          thumb: url(i * 2), large: url(i * 2 + 1),
          ...(preview ? { clean: url(list.length * 2 + i) } : {}),
        })),
      });
    }

    // ── UNLOCK ──
    if (action === "unlock") {
      const ids = Array.isArray(body.photo_ids) ? (body.photo_ids as unknown[]).filter((x) => typeof x === "string").slice(0, 200) as string[] : [];
      if (!ids.length) return json({ error: "photo_ids required" }, 400);
      const { data, error } = await sb.rpc("client_gallery_unlock", { p_gallery: g.id, p_photos: ids, p_order: null });
      if (error) throw error;
      const r = data as { ok: boolean };
      return json(r, r.ok ? 200 : 409);
    }

    // ── DOWNLOAD ──
    if (action === "download") {
      const ids = Array.isArray(body.photo_ids) ? (body.photo_ids as unknown[]).filter((x) => typeof x === "string").slice(0, 200) as string[] : [];
      let q = sb.from("client_gallery_unlocks").select("photo_id, client_gallery_photos!inner(id,position,filename,master_path)").eq("gallery_id", g.id);
      if (ids.length) q = q.in("photo_id", ids);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as unknown as Array<{ client_gallery_photos: { id: string; position: number; filename: string | null; master_path: string } }>;
      const out = [];
      for (const r of rows) {
        const p = r.client_gallery_photos;
        const ext = (/\.(jpe?g|png|tiff?|webp)$/i.exec(p.master_path)?.[1] ?? "jpg").toLowerCase();
        const name = p.filename && /\.[a-z0-9]{2,5}$/i.test(p.filename) ? p.filename : `${g.slug}-${String(p.position + 1).padStart(2, "0")}.${ext}`;
        const { data: s } = await sb.storage.from(BUCKET).createSignedUrl(p.master_path, DOWNLOAD_TTL, { download: name });
        if (s?.signedUrl) out.push({ id: p.id, name, url: s.signedUrl });
      }
      return json({ files: out });
    }

    // ── CHECKOUT (extra unlocks) ──
    if (action === "checkout") {
      const ids = Array.isArray(body.photo_ids) ? (body.photo_ids as unknown[]).filter((x) => typeof x === "string").slice(0, 200) as string[] : [];
      // Only count photos that are real, in this gallery, and still locked.
      let wanted: string[] = [];
      if (ids.length) {
        const { data: ph } = await sb.from("client_gallery_photos").select("id").eq("gallery_id", g.id).in("id", ids);
        const { data: un } = await sb.from("client_gallery_unlocks").select("photo_id").eq("gallery_id", g.id).in("photo_id", ids);
        const done = new Set((un ?? []).map((u: { photo_id: string }) => u.photo_id));
        wanted = (ph ?? []).map((p: { id: string }) => p.id).filter((id: string) => !done.has(id));
      }
      const a = await allowance(sb, g);
      const need = Math.max(0, wanted.length - a.remaining);
      const asked = Math.max(0, Math.min(500, parseInt(String(body.credits ?? 0), 10) || 0));
      const n = Math.max(need, asked);
      if (n < 1) return json({ error: "nothing to buy", remaining: a.remaining }, 400);
      const { credits, cents } = priceCredits(n, g);

      const back = `${SITE}/g/${g.slug}?code=${encodeURIComponent(g.access_code)}`;
      const p = new URLSearchParams();
      p.append("mode", "payment");
      p.append("success_url", `${back}&session_id={CHECKOUT_SESSION_ID}`);
      p.append("cancel_url", back);
      p.append("line_items[0][price_data][currency]", "usd");
      p.append("line_items[0][price_data][unit_amount]", String(cents));
      p.append("line_items[0][price_data][product_data][name]", `${credits} more photo${credits > 1 ? "s" : ""} · ${g.title}`);
      p.append("line_items[0][price_data][product_data][description]", `Full-resolution downloads from your private gallery`);
      p.append("line_items[0][quantity]", "1");
      p.append("metadata[kind]", "gallery");
      p.append("metadata[gallery_id]", g.id);
      p.append("metadata[credits]", String(credits));
      p.append("payment_intent_data[metadata][kind]", "gallery");
      p.append("payment_intent_data[description]", `Gallery extras: ${g.slug} (${credits})`);
      const key = Deno.env.get("STRIPE_SECRET_KEY");
      if (!key) throw new Error("STRIPE_SECRET_KEY not set");
      const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: p.toString(),
      });
      const s = await r.json();
      if (!r.ok) return json({ error: "stripe error", detail: s?.error?.message ?? null }, 502);
      const { error: insErr } = await sb.from("client_gallery_orders").insert({
        gallery_id: g.id, stripe_session_id: s.id, credits, amount_total: cents, photo_ids: wanted, status: "pending",
      });
      if (insErr) throw insErr;
      return json({ url: s.url, credits, cents });
    }

    // ── CLAIM (return from Stripe) ──
    if (action === "claim") {
      const sid = body.session_id;
      if (typeof sid !== "string" || !sid.startsWith("cs_")) return json({ error: "session_id required" }, 400);
      const { data: o } = await sb.from("client_gallery_orders").select("id,stripe_session_id,photo_ids,status")
        .eq("gallery_id", g.id).eq("stripe_session_id", sid).maybeSingle();
      if (!o) return json({ status: "unknown" }, 404);
      if (o.status !== "pending") return json({ status: o.status });
      return json(await settleOrder(sb, g, o));
    }

    // ── QUOTE (price preview for the buy panel, no side effects) ──
    if (action === "quote") {
      const n = Math.max(1, Math.min(500, parseInt(String(body.credits ?? 1), 10) || 1));
      return json(priceCredits(n, g));
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("client-gallery", action, String(e));
    return json({ error: "server error" }, 500);
  }
});
