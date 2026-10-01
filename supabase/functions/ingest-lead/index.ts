// ElevenLabs post-call webhook → leads table (+ optional email to the tenant's team).
//
// ElevenLabs signs each request: header `elevenlabs-signature: t=<unix>,v0=<hex>` where
// hex = HMAC-SHA256(secret, "<unix>.<raw body>"). Requests older than 30 minutes are rejected.
// Deployed with verify_jwt = false: ElevenLabs can't send a Supabase JWT, so the HMAC is the auth.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { escapeHtml, leadFromEvent, type PostCallEvent, verifySignature } from "./lib.ts";

function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status });
}

async function emailTeam(
  admin: SupabaseClient,
  tenant: { id: string; name: string; notify_email: string | null },
  lead: ReturnType<typeof leadFromEvent>,
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey || !lead.contact) return;

  let to: string[] = tenant.notify_email ? [tenant.notify_email] : [];
  if (to.length === 0) {
    const { data: members } = await admin
      .from("team_members")
      .select("user_id")
      .eq("tenant_id", tenant.id);
    for (const m of members ?? []) {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      if (data.user?.email) to.push(data.user.email);
    }
  }
  if (to.length === 0) return;

  const dashboard = Deno.env.get("DASHBOARD_URL") ?? "https://app.tryleaseline.com";
  const rows = [
    ["Name", lead.renter_name],
    ["Contact", lead.contact],
    ["Showing", lead.preferred_showing_time],
    ["Recommended", lead.recommended_listing_slug],
    ["Budget", lead.budget_monthly ? `$${lead.budget_monthly.toLocaleString("en-CA")}/mo` : null],
    ["Move-in", lead.move_in],
  ].filter(([, v]) => v) as [string, string][];

  const html = `
    <h2 style="font-family:sans-serif">New lead: ${escapeHtml(lead.renter_name ?? "Renter")}</h2>
    <table style="font-family:sans-serif;border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#5d6573">${k}</td><td style="padding:4px 0"><b>${escapeHtml(v)}</b></td></tr>`).join("")}
    </table>
    ${lead.summary ? `<p style="font-family:sans-serif;max-width:560px">${escapeHtml(lead.summary)}</p>` : ""}
    <p style="font-family:sans-serif"><a href="${dashboard}">Open the LeaseLine dashboard</a></p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("RESEND_FROM") ?? "LeaseLine <onboarding@resend.dev>",
      to,
      subject: `New lead for ${tenant.name}: ${lead.renter_name ?? "renter"}`,
      html,
    }),
  });
  if (!res.ok) console.error("resend failed", res.status, await res.text());
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const secret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");
  if (!secret) return json(503, { error: "webhook secret not configured" });

  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("elevenlabs-signature"), secret))) {
    return json(401, { error: "invalid signature" });
  }

  const event = JSON.parse(raw) as PostCallEvent;
  if (event.type !== "post_call_transcription") return json(200, { ignored: event.type });

  const secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"];
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id, name, notify_email")
    .eq("agent_id", event.data.agent_id)
    .maybeSingle();
  if (tenantError) throw tenantError;
  if (!tenant) return json(200, { ignored: "unknown agent" });

  const lead = leadFromEvent(event, tenant.id);
  const { data: existing } = await admin
    .from("leads")
    .select("id")
    .eq("conversation_id", lead.conversation_id)
    .maybeSingle();

  const { error } = await admin.from("leads").upsert(lead, { onConflict: "conversation_id" });
  if (error) {
    console.error("upsert failed", error);
    return json(500, { error: "could not store lead" });
  }

  // Webhooks can be retried; only email the first time we see a conversation.
  if (!existing) {
    try {
      await emailTeam(admin, tenant, lead);
    } catch (e) {
      console.error("email failed", e);
    }
  }
  return json(200, { stored: lead.conversation_id, new: !existing });
});
