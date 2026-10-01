// Server-only: turns an ElevenLabs conversation into the leasing team's view of one call.
// Only fields the team needs leave the server; the API key never does.
import "server-only";

import { getListings } from "@/lib/listings";
import { site } from "@/lib/site";

const API = "https://api.elevenlabs.io/v1/convai/conversations";
const ID_PATTERN = /^conv_[a-z0-9]{10,64}$/;

export type Check = { id: string; label: string; result: string; rationale: string };
export type Turn = { role: "agent" | "user"; message: string; atSecs: number };

export type TeamView = {
  status: string; // initiated | in-progress | processing | done | failed
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

// Order and labels for the data-collection fields configured in agent/config.yaml.
const LEAD_FIELDS: [key: string, label: string, format?: (v: unknown) => string][] = [
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

type Raw = {
  agent_id: string;
  status: string;
  metadata?: { call_duration_secs?: number; start_time_unix_secs?: number };
  analysis?: {
    call_successful?: string;
    call_summary_title?: string;
    transcript_summary?: string;
    data_collection_results?: Record<string, { value: unknown }>;
    evaluation_criteria_results?: Record<string, { result: string; rationale: string }>;
  } | null;
  transcript?: { role: string; message: string | null; time_in_call_secs: number }[];
};

export class NotFound extends Error {}

export function isConversationId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export async function getTeamView(id: string): Promise<TeamView> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set on the server");
  if (!isConversationId(id)) throw new NotFound();

  const res = await fetch(`${API}/${id}`, {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (res.status === 404 || res.status === 422) throw new NotFound();
  if (!res.ok) throw new Error(`ElevenLabs returned ${res.status}`);
  const raw = (await res.json()) as Raw;

  // Only this deployment's agent: the endpoint can't be used to read other agents' calls.
  if (raw.agent_id !== site.agentId) throw new NotFound();

  const a = raw.analysis ?? {};
  const dc = a.data_collection_results ?? {};
  const value = (key: string) => dc[key]?.value;
  const recommendedId = value("recommended_listing_id");

  return {
    status: raw.status,
    title: a.call_summary_title ?? null,
    summary: a.transcript_summary ?? null,
    outcome: a.call_successful ?? null,
    durationSecs: raw.metadata?.call_duration_secs ?? null,
    startedAt: raw.metadata?.start_time_unix_secs ?? null,
    recommendedHome:
      (await getListings()).find((l) => l.id === recommendedId)?.title ??
      (recommendedId ? String(recommendedId) : null),
    lead: LEAD_FIELDS.flatMap(([key, label, format]) => {
      const v = value(key);
      if (v === null || v === undefined || v === "") return [];
      return [{ label, value: format ? format(v) : String(v) }];
    }),
    checks: Object.entries(a.evaluation_criteria_results ?? {}).map(([id, r]) => ({
      id,
      label: CHECK_LABELS[id] ?? id,
      result: r.result,
      rationale: r.rationale,
    })),
    transcript: (raw.transcript ?? [])
      .filter((t) => t.message && (t.role === "agent" || t.role === "user"))
      .map((t) => ({
        role: t.role as Turn["role"],
        message: t.message as string,
        atSecs: t.time_in_call_secs,
      })),
  };
}
