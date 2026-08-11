import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Sends two emails when a booking request lands:
//   1. the client  — confirmation plus their accepted agreement, so "ask for a copy"
//      stops being a manual job
//   2. Stuart      — the request itself, so nothing sits unseen in a table
//
// v2 (2026-08-10): the HTML now wears the /book paper palette instead of the
// browser default. Same data, same guards, same send order — only the shell
// changed. v1 is snapshotted at _edge_fn_snapshots/send-booking-emails.v1.ts.
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

// ─── design tokens, lifted straight off #photos-page.book-on ────────────────
// Anything that isn't one of these is a drift from the site, not a choice.
const PAPER = "#f6f5f2"; // .svc-card / .bk-cell surface
const PAPER_DEEP = "#efeee9"; // .svc-card:hover — used as the page behind the sheet
const RULE = "#d8d5cd"; // every hairline on /book
const INK = "#1a1a1a";
const BODY = "#4a4640"; // .bk-doc text
const MUTE = "#8a857c"; // .bk-sec
const FAINT = "#b3aea3"; // .bk-label
const DOC = "#fbfaf8"; // .bk-doc surface

// Web fonts land in Apple Mail and most iOS clients; everywhere else the stack
// falls back. The fallbacks are chosen so the *shape* survives — condensed caps
// for the display line, a typewriter for the labels — because the tracking and
// caps do most of the branding work, not the fonts themselves.
const F_MONO = "'Share Tech Mono','Courier New',Courier,monospace";
const F_DISP = "'Bebas Neue','Oswald','Arial Narrow',Impact,sans-serif";
const F_SANS = "'DM Sans',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif";

const PAD = "padding:0 34px";

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

// .bk-sec — the uppercase mono rule that opens every block on the form
function sec(label: string): string {
  return (
    `<tr><td style="${PAD};padding-top:30px;padding-bottom:10px;font-family:${F_MONO};` +
    `font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${MUTE}">${esc(label)}</td></tr>`
  );
}

// .bk-grid — cellspacing:1 over a RULE-coloured table is the email-safe way to
// get the same hairline seams the site gets from `gap:1px` + outline.
function grid(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([k, v]) =>
        `<tr><td bgcolor="${PAPER}" style="padding:14px 16px">` +
        `<div style="font-family:${F_MONO};font-size:9px;letter-spacing:.18em;` +
        `text-transform:uppercase;color:${FAINT};padding-bottom:7px">${esc(k)}</div>` +
        `<div style="font-family:${F_SANS};font-size:13px;line-height:1.6;color:${INK}">${v}</div>` +
        `</td></tr>`,
    )
    .join("");
  return (
    `<tr><td style="${PAD}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="1" border="0" ` +
    `bgcolor="${RULE}" style="border-collapse:separate">${cells}</table></td></tr>`
  );
}

function para(html: string, extra = ""): string {
  return (
    `<tr><td style="${PAD};padding-top:14px;font-family:${F_SANS};font-size:15px;` +
    `line-height:1.65;color:${BODY};${extra}">${html}</td></tr>`
  );
}

/** The paper sheet. Mirrors /book: nav hairline, mono eyebrow, Bebas hero, mono sub. */
function shell(opts: {
  preheader: string;
  hero: string;
  sub: string;
  rows: string;
}): string {
  return (
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">` +
    `<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Bebas+Neue&family=DM+Sans:wght@200;300;400&display=swap" rel="stylesheet">` +
    `<style>@media only screen and (max-width:620px){.pad{padding-left:22px!important;padding-right:22px!important}.hero{font-size:44px!important}}</style>` +
    `</head><body style="margin:0;padding:0;background:${PAPER_DEEP};-webkit-text-size-adjust:100%">` +
    // preheader: what shows in the inbox list before anyone opens it
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">` +
    esc(opts.preheader) + `</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER_DEEP}">` +
    `<tr><td align="center" style="padding:34px 14px 44px">` +
    `<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" ` +
    `style="width:640px;max-width:640px;background:${PAPER};border:1px solid ${RULE}">` +
    // .page-nav
    `<tr><td style="padding:13px 34px;border-bottom:1px solid ${RULE};font-family:${F_MONO};` +
    `font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:${FAINT}">` +
    `stuartsingleton.com` +
    `<span style="float:right;color:${FAINT}">Nashville, TN</span></td></tr>` +
    // hero block
    `<tr><td class="pad" style="${PAD};padding-top:46px;padding-bottom:4px;font-family:${F_MONO};` +
    `font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#9a948a">Stuart Singleton</td></tr>` +
    `<tr><td class="pad" style="${PAD}"><div class="hero" style="font-family:${F_DISP};font-size:58px;` +
    `line-height:.9;letter-spacing:.02em;text-transform:uppercase;color:${INK}">${esc(opts.hero)}</div></td></tr>` +
    `<tr><td class="pad" style="${PAD};padding-top:10px;padding-bottom:20px;font-family:${F_MONO};` +
    `font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:${MUTE}">${esc(opts.sub)}</td></tr>` +
    opts.rows +
    // footer
    `<tr><td class="pad" style="${PAD};padding-top:26px;padding-bottom:28px;border-top:1px solid ${RULE};` +
    `margin-top:30px;font-family:${F_MONO};font-size:9px;letter-spacing:.12em;text-transform:uppercase;` +
    `line-height:1.9;color:${FAINT}">` +
    `Stuart Singleton · Nashville, TN<br>` +
    `<a href="https://stuartsingleton.com" style="color:${MUTE};text-decoration:underline">stuartsingleton.com</a>` +
    `</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
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
    const retainer = b.quoted_total_cents
      ? money(b.retainer_cents ?? Math.round(b.quoted_total_cents / 2))
      : null;

    // ── client confirmation ──────────────────────────────────────────────
    let agreementRows = "";
    if (b.acceptance_id) {
      const { data: a } = await db
        .from("agreement_acceptances")
        .select("agreement_text, created_at")
        .eq("id", b.acceptance_id)
        .single();
      if (a?.agreement_text) {
        agreementRows =
          sec("Your copy of the agreement") +
          `<tr><td class="pad" style="${PAD};font-family:${F_MONO};font-size:9px;` +
          `letter-spacing:.12em;text-transform:uppercase;color:${FAINT};line-height:1.7;padding-bottom:12px">` +
          `Accepted ${esc(new Date(a.created_at).toLocaleString())} · keep this email</td></tr>` +
          `<tr><td class="pad" style="${PAD}"><div style="background:${DOC};border:1px solid ${RULE};` +
          `padding:20px 22px;font-family:${F_SANS};font-size:12px;line-height:1.75;color:${BODY};` +
          `white-space:pre-wrap">${esc(a.agreement_text)}</div></td></tr>`;
      }
    }

    let clientRows =
      para(`Hi ${esc(b.name)} — got your request for a <b style="color:${INK}">${esc(svc)}</b>. ` +
        `Nothing has been charged.`) +
      grid([
        ["Dates you gave me", fmtSlots(b.preferred_slots) +
          (b.date_flexible ? `<br><span style="color:${MUTE}">and you said you're flexible</span>` : "")],
      ]);

    if (b.quoted_total_cents) {
      clientRows += grid([
        ["Total", `${money(b.quoted_total_cents)}`],
        ["Retainer", `${retainer} — the rest on delivery`],
      ]);
    }

    clientRows += isCall
      ? para(`I'll come back to you within a day with a time. Nothing to sign for a call.`)
      : para(`I'll come back to you within a day and confirm which date works. If it does, ` +
        `I'll send a retainer link — <b style="color:${INK}">the retainer is what secures the date</b>. ` +
        `Until it clears the date stays open, so it's first come.`);

    clientRows +=
      para(`Anything you want to talk through before then, just reply to this.`) +
      para(`Stuart`, `padding-bottom:6px`) +
      agreementRows;

    const clientHtml = shell({
      preheader: isCall
        ? `Got your call request. Nothing charged — I'll come back within a day.`
        : `Got your ${svc} request. Nothing charged — I'll come back within a day.`,
      hero: "Request in",
      sub: isCall ? "Free call · nothing charged" : `${svc} · nothing charged yet`,
      rows: clientRows,
    });

    // ── Stuart's copy ────────────────────────────────────────────────────
    const detail: Array<[string, string]> = [
      ["Contact", esc(b.email) + (b.phone ? `<br>${esc(b.phone)}` : "")],
      ["Dates", fmtSlots(b.preferred_slots) + (b.date_flexible ? ` <span style="color:${MUTE}">(flexible)</span>` : "")],
    ];
    if (b.what_shooting) detail.push(["Shooting", esc(b.what_shooting)]);
    if (b.location) detail.push(["Location", esc(b.location)]);
    if (b.notes) detail.push(["Notes", esc(b.notes)]);
    detail.push([
      "Money",
      b.quoted_total_cents
        ? `${money(b.quoted_total_cents)} quoted · ${retainer} retainer`
        : `No charge`,
    ]);
    detail.push([
      "Agreement",
      b.acceptance_id ? `Accepted and on file` : `None — free call, none needed`,
    ]);

    const ownerHtml = shell({
      preheader: `${b.name} · ${svc}`,
      hero: "New request",
      sub: `${b.name} · ${svc}`,
      rows:
        grid(detail) +
        para(`Approve it in the booking-approvals view to start the 72-hour hold. ` +
          `Replying to this email goes straight to ${esc(b.name)}.`,
          `font-size:13px;color:${MUTE}`),
    });

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
