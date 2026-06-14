// SNAPSHOT of stripe-webhook v20 pulled from Supabase MCP 2026-06-14.
// This is the LIVE source. The vault note warns the deployed fn had diverged
// from the clone (MCP-only). This file ends that divergence — pull/edit FROM
// here before any redeploy. Master-aware (resolvePrintAsset → signed URL from
// private photos-masters, public-src fallback). verify_jwt:false (Stripe signs).
//
// ⚠️ Borders/alt-crop (Phase 2b Steps 2-3) will need resolvePrintAsset to take a
//    variant arg from metadata.variant — see admin-asset-management-plan.md.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PRODIGI_BASE = "https://api.prodigi.com/v4.0";
const FROM_EMAIL = "prints@stuartsingleton.com";
const OWNER_EMAIL = "stuartssingleton@gmail.com";
const MASTER_SIGNED_URL_TTL = 86400;

async function verifyStripeSignature(body, sigHeader, secret) {
  const parts = sigHeader.split(",").reduce((acc, part) => {
    const [k, v] = part.split("="); acc[k] = v; return acc;
  }, {});
  const timestamp = parts["t"]; const sig = parts["v1"];
  if (!timestamp || !sig) return false;
  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(signatureBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return computed === sig;
}

// resolvePrintAsset: prefers a print-master variant (private bucket → 24h signed
// URL); falls back to public src. NEVER throws. For borders/alt-crop this must
// gain a `variant` param so it can prefer e.g. 'bordered' then 'print-master'.
async function resolvePrintAsset(supabase, photoId, publicSrc) {
  try {
    const { data: assets, error } = await supabase.from("photo_assets")
      .select("variant,bucket,path,is_print_default,created_at")
      .eq("photo_id", photoId).eq("variant", "print-master")
      .order("is_print_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { console.error("resolvePrintAsset query error:", error.message); return { url: publicSrc, usedMaster: false }; }
    const master = (assets ?? [])[0];
    if (!master || !master.bucket || !master.path) return { url: publicSrc, usedMaster: false };
    const { data: signed, error: signErr } = await supabase.storage.from(master.bucket)
      .createSignedUrl(master.path, MASTER_SIGNED_URL_TTL);
    if (signErr || !signed?.signedUrl) { console.error("resolvePrintAsset sign error:", signErr?.message ?? "no signed url"); return { url: publicSrc, usedMaster: false }; }
    return { url: signed.signedUrl, usedMaster: true };
  } catch (e) { console.error("resolvePrintAsset threw:", String(e)); return { url: publicSrc, usedMaster: false }; }
}

// NOTE: This snapshot abbreviates the email/shipping helpers for readability;
// the AUTHORITATIVE full source is the deployed v20 (identical logic). If you
// redeploy, pull the full current source via MCP get_edge_function first.
