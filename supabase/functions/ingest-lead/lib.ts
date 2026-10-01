// Pure helpers for the ingest-lead function (unit-tested in lib_test.ts).

const TOLERANCE_SECS = 30 * 60;
const encoder = new TextEncoder();

type DataCollection = Record<string, { value?: unknown } | undefined>;
type Evaluation = Record<string, { result?: string; rationale?: string } | undefined>;

export type PostCallEvent = {
  type: string;
  data: {
    conversation_id: string;
    agent_id: string;
    analysis?: {
      call_successful?: string;
      call_summary_title?: string;
      transcript_summary?: string;
      data_collection_results?: DataCollection;
      evaluation_criteria_results?: Evaluation;
    };
    metadata?: { start_time_unix_secs?: number; call_duration_secs?: number };
  };
};

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSecs = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || !parts.v0) return false;
  if (Math.abs(nowSecs - timestamp) > TOLERANCE_SECS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${parts.t}.${rawBody}`));
  return timingSafeEqual(toHex(mac), parts.v0);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

export function leadFromEvent(event: PostCallEvent, tenantId: string) {
  const d = event.data;
  const dc = d.analysis?.data_collection_results ?? {};
  const text = (k: string) => {
    const v = dc[k]?.value;
    return v === null || v === undefined || v === "" ? null : String(v);
  };
  const int = (k: string) => {
    const v = Number(dc[k]?.value);
    return Number.isFinite(v) && dc[k]?.value !== null && dc[k]?.value !== "" ? Math.round(v) : null;
  };
  const started = d.metadata?.start_time_unix_secs;
  return {
    tenant_id: tenantId,
    conversation_id: d.conversation_id,
    agent_id: d.agent_id,
    renter_name: text("renter_name"),
    contact: text("contact"),
    preferred_showing_time: text("preferred_showing_time"),
    recommended_listing_slug: text("recommended_listing_id"),
    budget_monthly: int("budget_monthly"),
    bedrooms_needed: int("bedrooms_needed"),
    move_in: text("move_in"),
    pets: text("pets"),
    vehicles: int("vehicles"),
    title: d.analysis?.call_summary_title ?? null,
    summary: d.analysis?.transcript_summary ?? null,
    call_successful: d.analysis?.call_successful ?? null,
    evaluation: d.analysis?.evaluation_criteria_results ?? {},
    data_collection: dc,
    duration_secs: d.metadata?.call_duration_secs ?? null,
    started_at: started ? new Date(started * 1000).toISOString() : null,
  };
}
