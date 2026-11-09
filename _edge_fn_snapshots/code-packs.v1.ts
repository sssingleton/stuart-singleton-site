import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// code-packs v1 (2026-11-09): the Shop downloads page sends a code and gets back the packs it
// unlocks with their file list (names + ids only; files still need download-preset + the code).
// A code unlocks: every pack if is_bundle, its own pack_id, plus any code_packs rows.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { code } = await req.json();
    if (typeof code !== "string" || code.length < 4 || code.length > 40) return json({ error: "Enter a valid code." }, 400);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: c } = await sb.from("codes").select("id,pack_id,is_bundle,expires_at").eq("code", code.trim().toUpperCase()).maybeSingle();
    if (!c || (c.expires_at && new Date(c.expires_at) < new Date())) return json({ error: "That code isn't valid." }, 404);
    let q = sb.from("packs").select("id,slug,name,kind,cover_image_url,sort_order,pack_files(id,file_name,file_size)").eq("is_active", true);
    if (!c.is_bundle) {
      const { data: extra } = await sb.from("code_packs").select("pack_id").eq("code_id", c.id);
      const ids = [...new Set([c.pack_id, ...(extra ?? []).map((r: { pack_id: string }) => r.pack_id)].filter(Boolean))];
      q = q.in("id", ids);
    }
    const { data: packs, error } = await q.order("kind", { ascending: false }).order("sort_order");
    if (error) return json({ error: "Could not load your downloads." }, 500);
    return json({ code: code.trim().toUpperCase(), packs });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
