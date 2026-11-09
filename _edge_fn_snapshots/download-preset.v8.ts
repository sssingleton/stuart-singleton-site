import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// download-preset v8 (2026-11-09): a code also grants every pack linked to it in code_packs
// (multi-pack Shop orders). Accepts pack_id as well as pack_slug. Otherwise identical to v5:
// a download REQUIRES a code that grants the pack; signed URL lives 5 minutes.
// Rollback: v7 = this file without the code_packs lookup and pack_id param.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { pack_slug, pack_id, file_id, code } = await req.json();
    if ((!pack_slug && !pack_id) || !file_id) return json({ error: "Missing pack or file_id" }, 400);
    if (!code || typeof code !== "string") return json({ error: "This pack is locked. Buy it or redeem a code." }, 403);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let pq = admin.from("packs").select("id, slug").eq("is_active", true);
    pq = pack_id ? pq.eq("id", pack_id) : pq.eq("slug", pack_slug);
    const { data: pack } = await pq.maybeSingle();
    if (!pack) return json({ error: "Pack not found" }, 404);

    const { data: codeRow } = await admin.from("codes").select("id, pack_id, is_bundle, expires_at").eq("code", code.trim().toUpperCase()).maybeSingle();
    let grants = !!codeRow && (codeRow.is_bundle || codeRow.pack_id === pack.id);
    if (codeRow && !grants) {
      const { data: link } = await admin.from("code_packs").select("pack_id").eq("code_id", codeRow.id).eq("pack_id", pack.id).maybeSingle();
      grants = !!link;
    }
    const expired = !!codeRow?.expires_at && new Date(codeRow.expires_at) < new Date();
    if (!grants || expired) return json({ error: "That code doesn't unlock this pack." }, 403);

    const { data: fileRecord } = await admin.from("pack_files").select("*").eq("id", file_id).eq("pack_id", pack.id).maybeSingle();
    if (!fileRecord) return json({ error: "File not found" }, 404);

    const { data: signed, error: signError } = await admin.storage.from("preset-files")
      .createSignedUrl(fileRecord.storage_path, 300, { download: fileRecord.file_name });
    if (signError || !signed) { console.error("Signed URL error:", signError); return json({ error: "Failed to generate download link" }, 500); }
    console.log(`download ok: ${fileRecord.file_name} (${pack.slug})`);
    return json({ url: signed.signedUrl, file_name: fileRecord.file_name });
  } catch (err) {
    console.error("Download preset error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
