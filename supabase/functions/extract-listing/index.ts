// Paste-to-fill for the dashboard: a team editor pastes listing text, Claude extracts the
// fields, the dashboard pre-fills the listing form for review. Nothing is saved here.
//
// verify_jwt = true: only signed-in users can call it, and we additionally require that they
// can edit listings for some tenant (team_members role admin/editor, read through RLS).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@supabase/supabase-js";

import { ExtractedListing, SYSTEM_PROMPT, toFormValues } from "./lib.ts";

const MAX_INPUT_CHARS = 20_000;

// Called server-side by the dashboard (no browser CORS needed).
function json(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json(503, { error: "Paste-to-fill isn't set up yet." });

  // Act as the caller so RLS applies to the membership check.
  const publishable = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")!)["default"];
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publishable, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return json(401, { error: "Sign in first." });
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "editor"])
    .limit(1)
    .maybeSingle();
  if (!membership) return json(403, { error: "Only editors can add listings." });

  let text: string;
  try {
    text = String((await req.json()).text ?? "").trim();
  } catch {
    return json(400, { error: "Send JSON: { text }" });
  }
  if (text.length < 40) return json(400, { error: "Paste more of the listing (at least a few sentences)." });
  if (text.length > MAX_INPUT_CHARS) return json(400, { error: "That's too long; paste just the listing." });

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      // Short extraction: low effort keeps it fast; thinking stays adaptive (can't be disabled).
      output_config: { effort: "low", format: zodOutputFormat(ExtractedListing) },
      // If a safety classifier declines, retry on a fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `<listing>\n${text}\n</listing>` }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return json(422, { error: "Couldn't read that listing. Fill the form in by hand." });
    }
    return json(200, { values: toFormValues(response.parsed_output) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(429, { error: "Busy. Try again in a minute." });
    if (e instanceof Anthropic.APIError) {
      console.error("anthropic error", e.status, e.message);
      return json(502, { error: "The extraction service failed. Try again." });
    }
    throw e;
  }
});
