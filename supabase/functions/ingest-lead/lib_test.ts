import { assertEquals } from "jsr:@std/assert@1";

import { escapeHtml, leadFromEvent, type PostCallEvent, verifySignature } from "./lib.ts";

const SECRET = "whsec_test";
const BODY = '{"type":"post_call_transcription"}';

async function sign(body: string, t: number, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${t},v0=${hex}`;
}

Deno.test("accepts a valid signature", async () => {
  const now = 1_790_000_000;
  assertEquals(await verifySignature(BODY, await sign(BODY, now), SECRET, now), true);
});

Deno.test("rejects a tampered body", async () => {
  const now = 1_790_000_000;
  assertEquals(await verifySignature(BODY + " ", await sign(BODY, now), SECRET, now), false);
});

Deno.test("rejects the wrong secret", async () => {
  const now = 1_790_000_000;
  assertEquals(await verifySignature(BODY, await sign(BODY, now, "other"), SECRET, now), false);
});

Deno.test("rejects stale and missing signatures", async () => {
  const now = 1_790_000_000;
  const old = await sign(BODY, now - 31 * 60);
  assertEquals(await verifySignature(BODY, old, SECRET, now), false);
  assertEquals(await verifySignature(BODY, null, SECRET, now), false);
  assertEquals(await verifySignature(BODY, "t=abc,v0=00", SECRET, now), false);
});

Deno.test("maps a post-call event to a lead row", () => {
  const event: PostCallEvent = {
    type: "post_call_transcription",
    data: {
      conversation_id: "conv_abc",
      agent_id: "agent_x",
      analysis: {
        call_successful: "success",
        call_summary_title: "Showing booked",
        transcript_summary: "Renter wants Gladstone.",
        data_collection_results: {
          renter_name: { value: "Jane" },
          contact: { value: "613-555-0100" },
          recommended_listing_id: { value: "gladstone-920-1" },
          budget_monthly: { value: 2700 },
          bedrooms_needed: { value: "2" },
          vehicles: { value: null },
          move_in: { value: "" },
        },
        evaluation_criteria_results: { collected_contact: { result: "success", rationale: "ok" } },
      },
      metadata: { start_time_unix_secs: 1_790_000_000, call_duration_secs: 87 },
      transcript: [
        { role: "agent", message: "Hi, I'm Nora.", time_in_call_secs: 0 },
        { role: "agent", message: null, time_in_call_secs: 4 },
        { role: "user", message: "Two bedrooms, please.", time_in_call_secs: 5 },
      ],
    },
  };
  const lead = leadFromEvent(event, "tenant-1");
  assertEquals(lead.transcript, [
    { role: "agent", message: "Hi, I'm Nora.", at_secs: 0 },
    { role: "user", message: "Two bedrooms, please.", at_secs: 5 },
  ]);
  assertEquals(lead.tenant_id, "tenant-1");
  assertEquals(lead.renter_name, "Jane");
  assertEquals(lead.recommended_listing_slug, "gladstone-920-1");
  assertEquals(lead.budget_monthly, 2700);
  assertEquals(lead.bedrooms_needed, 2);
  assertEquals(lead.vehicles, null);
  assertEquals(lead.move_in, null);
  assertEquals(lead.duration_secs, 87);
  assertEquals(lead.started_at, new Date(1_790_000_000_000).toISOString());
});

Deno.test("escapes HTML in emails", () => {
  assertEquals(escapeHtml('<b>"x" & y</b>'), "&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;");
});
