// SNAPSHOT of send-booking-emails version 1 (deployed 2026-08-08, replaced 2026-08-10 by v2).
// Kept so the unbranded-email version is restorable if the rebrand misbehaves in a client.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Sends two emails when a booking request lands:
//   1. the client  — confirmation plus their accepted agreement, so "ask for a copy"
//      stops being a manual job
//   2. Stuart      — the request itself, so nothing sits unseen in a table
//
// verify_jwt is OFF because the site calls this anonymously right after inserting.
// The guard is not a JWT, it is that the function only ever emails addresses it
// reads from the database itself: the caller supplies a booking id and nothing
// else, so the worst a stranger can do is re-trigger a send that is already
// blocked by notified_at.

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("BOOKING_FROM") ?? "Stuart Singleton <hello@stuartsingleton.com>";
const OWNER = Deno.env.get("BOOKING_OWNER") ?? "hello@stuartsingleton.com";

const SERVICES: Record<string, string> = {
  call: "free 15-minute call",
  portrait: "portrait session",
  band: "band press photos",
  live: "live show coverage",
  commercial: "commercial shoot",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}

function fmtSlots(slots: Array<{ date?: string; time?: string }> | null): string {
  if (!slots || !slots.length) return "no dates given";
  return slots
    .map((s) => esc(s.date) + (s.time ? " at " + esc(s.time) : ""))
    .join("<br>");
}

async function send(to: string, subject: string, html: string, replyTo?: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
  return await r.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (!RESEND_KEY) throw new Error("RESEND_API_KEY is not set on this project");

    const { booking_id } = await req.json();
    if (!booking_id || !/^[0-9a-f-]{36}$/i.test(String(booking_id))) {
      throw new Error("booking_id must be a uuid");
    }

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: b, error } = await db
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single();
    if (error || !b) throw new Error("booking not found");

    // Idempotency: a retry, a double-click or a stranger poking the endpoint
    // must not produce a second email.
    if (b.notified_at) {
      return new Response(JSON.stringify({ ok: true, skipped: "already notified" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const svc = SERVICES[b.service] ?? b.service;
    const isCall = b.service === "call";
    const money = (c: number | null) =>
      c == null ? null : "$" + Math.round(c / 100).toLocaleString();

    // ── client confirmation ──────────────────────────────────────────────
    let agreementHtml = "";
    if (b.acceptance_id) {
      const { data: a } = await db
        .from("agreement_acceptances")
        .select("agreement_text, created_at")
        .eq("id", b.acceptance_id)
        .single();
      if (a?.agreement_text) {
        agreementHtml =
          `<hr style="border:none;border-top:1px solid #d8d5cd;margin:32px 0">` +
          `<p style="font-size:13px;color:#8a857c">Your copy of the agreement you accepted on ` +
          `${esc(new Date(a.created_at).toLocaleString())}. Keep this email.</p>` +
          `<pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;` +
          `font-size:12px;line-height:1.7;color:#4a4640;background:#faf9f6;` +
          `border:1px solid #e6e3dc;padding:18px;border-radius:8px">` +
          esc(a.agreement_text) + `</pre>`;
      }
    }

    const clientHtml =
      `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;` +
      `line-height:1.65;color:#1a1a1a;max-width:640px">` +
      `<p>Hi ${esc(b.name)},</p>` +
      `<p>Got your request for a ${esc(svc)}. Nothing has been charged.</p>` +
      `<p><b>Dates you gave me</b><br>${fmtSlots(b.preferred_slots)}` +
      (b.date_flexible ? `<br><i>and you said you're flexible</i>` : ``) + `</p>` +
      (isCall
        ? `<p>I'll come back to you within a day with a time. Nothing to sign for a call.</p>`
        : `<p>I'll come back to you within a day and confirm which date works. If it does, ` +
          `I'll send a retainer link — <b>the retainer is what secures the date</b>. ` +
          `Until it clears the date stays open, so it's first come.</p>`) +
      (b.quoted_total_cents
        ? `<p><b>${money(b.quoted_total_cents)}</b> total, ` +
          `${money(b.retainer_cents ?? Math.round(b.quoted_total_cents / 2))} retainer, ` +
          `the rest on delivery.</p>`
        : ``) +
      `<p>Anything you want to talk through before then, just reply to this.</p>` +
      `<p>Stuart</p>` +
      agreementHtml +
      `</div>`;

    // ── Stuart's copy ────────────────────────────────────────────────────
    const ownerHtml =
      `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;` +
      `line-height:1.65;color:#1a1a1a;max-width:640px">` +
      `<p style="font-size:18px;margin:0 0 4px"><b>${esc(b.name)}</b> — ${esc(svc)}</p>` +
      `<p style="color:#8a857c;margin:0 0 20px">${esc(b.email)}` +
      (b.phone ? ` · ${esc(b.phone)}` : ``) + `</p>` +
      `<p><b>Dates</b><br>${fmtSlots(b.preferred_slots)}` +
      (b.date_flexible ? ` <i>(flexible)</i>` : ``) + `</p>` +
      (b.what_shooting ? `<p><b>Shooting</b><br>${esc(b.what_shooting)}</p>` : ``) +
      (b.location ? `<p><b>Location</b><br>${esc(b.location)}</p>` : ``) +
      (b.notes ? `<p><b>Notes</b><br>${esc(b.notes)}</p>` : ``) +
      (b.quoted_total_cents
        ? `<p><b>Quoted</b> ${money(b.quoted_total_cents)}, retainer ` +
          `${money(b.retainer_cents ?? Math.round(b.quoted_total_cents / 2))}</p>`
        : `<p><b>No charge</b></p>`) +
      `<p style="color:#8a857c;font-size:13px">` +
      (b.acceptance_id
        ? `Agreement accepted and on file.`
        : `No agreement — free call, none needed.`) +
      `<br>Approve it in the booking-approvals view to start the 72-hour hold.</p>` +
      `</div>`;

    const results: Record<string, unknown> = {};
    // Stuart's copy goes first: if the client send fails, he still learns about the
    // request, which is the failure that actually costs money.
    results.owner = await send(OWNER, `Booking request — ${b.name} · ${svc}`, ownerHtml, b.email);
    results.client = await send(
      b.email,
      isCall ? `Got your call request` : `Got your request — ${svc}`,
      clientHtml,
    );

    await db.from("bookings").update({ notified_at: new Date().toISOString() }).eq("id", b.id);

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Never fail the booking because email failed. The row is already saved.
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
