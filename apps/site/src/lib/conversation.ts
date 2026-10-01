// Server-only: the leasing team's view of one call, read from Supabase.
// The post-call webhook (supabase/functions/ingest-lead) stores each call as a lead; the
// `call_result` database function returns one call by its conversation id, with only the fields
// this page shows. Until the webhook lands (about a minute after hanging up) there's no row yet.
import "server-only";

import { getListings, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/listings";

const ID_PATTERN = /^conv_[a-z0-9]{10,64}$/;

export type Check = { id: string; label: string; result: string; rationale: string };
export type Turn = { role: "agent" | "user"; message: string; atSecs: number };

export type TeamView = {
  status: "processing" | "done";
  title: string | null;
  summary: string | null;
  outcome: string | null; // success | failure | unknown
  durationSecs: number | null;
  startedAt: number | null; // unix seconds
  lead: { label: string; value: string }[];
  recommendedHome: string | null;
  checks: Check[];
  transcript: Turn[];
};

type CallResult = {
  title: string | null;
  summary: string | null;
  call_successful: string | null;
  duration_secs: number | null;
  started_at: string | null;
  renter_name: string | null;
  contact: string | null;
  preferred_showing_time: string | null;
  budget_monthly: number | null;
  bedrooms_needed: number | null;
  move_in: string | null;
  vehicles: number | null;
  pets: string | null;
  recommended_listing_slug: string | null;
  evaluation: Record<string, { result?: string; rationale?: string }>;
  transcript: { role: "agent" | "user"; message: string; at_secs: number }[];
};

// Order and labels for the data-collection fields configured in agent/config.yaml.
const LEAD_FIELDS: [key: keyof CallResult, label: string, format?: (v: unknown) => string][] = [
  ["renter_name", "Name"],
  ["contact", "Contact"],
  ["preferred_showing_time", "Preferred showing"],
  ["budget_monthly", "Budget", (v) => `$${Number(v).toLocaleString("en-CA")}/month`],
  ["bedrooms_needed", "Bedrooms"],
  ["move_in", "Move-in"],
  ["vehicles", "Vehicles"],
  ["pets", "Pets"],
];

const CHECK_LABELS: Record<string, string> = {
  recommended_with_reasons: "Recommended a home, with reasons",
  collected_contact: "Collected and confirmed contact details",
  stayed_factual: "Stayed factual (no guessed details)",
};

const PROCESSING: TeamView = {
  status: "processing",
  title: null,
  summary: null,
  outcome: null,
  durationSecs: null,
  startedAt: null,
  lead: [],
  recommendedHome: null,
  checks: [],
  transcript: [],
};

export class NotFound extends Error {}

export function isConversationId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export async function getTeamView(id: string): Promise<TeamView> {
  if (!isConversationId(id)) throw new NotFound();

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/call_result`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_conversation_id: id }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase returned ${res.status}`);
  const call = (await res.json()) as CallResult | null;
  if (!call) return PROCESSING;

  const slug = call.recommended_listing_slug;
  return {
    status: "done",
    title: call.title,
    summary: call.summary,
    outcome: call.call_successful,
    durationSecs: call.duration_secs,
    startedAt: call.started_at ? Math.floor(Date.parse(call.started_at) / 1000) : null,
    recommendedHome: slug ? ((await getListings()).find((l) => l.id === slug)?.title ?? slug) : null,
    lead: LEAD_FIELDS.flatMap(([key, label, format]) => {
      const v = call[key];
      if (v === null || v === undefined || v === "") return [];
      return [{ label, value: format ? format(v) : String(v) }];
    }),
    checks: Object.entries(call.evaluation ?? {}).map(([id, r]) => ({
      id,
      label: CHECK_LABELS[id] ?? id,
      result: r.result ?? "unknown",
      rationale: r.rationale ?? "",
    })),
    transcript: (call.transcript ?? []).map((t) => ({
      role: t.role,
      message: t.message,
      atSecs: t.at_secs,
    })),
  };
}
