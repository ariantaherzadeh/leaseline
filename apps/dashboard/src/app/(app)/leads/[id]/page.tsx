import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDuration, formatMoney, formatWhen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getTeam } from "@/lib/team";

import { updateLead } from "./actions";

type Check = { result?: string; rationale?: string };

const CHECK_LABELS: Record<string, string> = {
  recommended_with_reasons: "Recommended a home, with reasons",
  collected_contact: "Collected and confirmed contact details",
  stayed_factual: "Stayed factual (no guessed details)",
};

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  const team = (await getTeam())!;
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead) notFound();

  const facts: [string, string | null][] = [
    ["Contact", lead.contact],
    ["Preferred showing", lead.preferred_showing_time],
    ["Interested in", lead.recommended_listing_slug],
    ["Budget", lead.budget_monthly === null ? null : `${formatMoney(lead.budget_monthly)}/mo`],
    ["Bedrooms", lead.bedrooms_needed?.toString() ?? null],
    ["Move-in", lead.move_in],
    ["Vehicles", lead.vehicles?.toString() ?? null],
    ["Pets", lead.pets],
  ];
  const checks = Object.entries((lead.evaluation ?? {}) as Record<string, Check>);

  return (
    <>
      <p>
        <Link href="/" className="back">
          ← All leads
        </Link>
      </p>
      <div className="page-head">
        <div>
          <h1>{lead.renter_name ?? "Unnamed renter"}</h1>
          <p className="muted">
            {lead.title ?? "Call"} · {formatWhen(lead.created_at)} · {formatDuration(lead.duration_secs)}
          </p>
        </div>
        <span className={`badge badge-${lead.status}`}>{lead.status}</span>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Details</h2>
          <dl className="facts">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? <span className="muted">Not given</span>}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card">
          <h2>Follow-up</h2>
          <form action={updateLead} className="stack">
            <input type="hidden" name="id" value={lead.id} />
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={lead.status} disabled={!team.canEdit}>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea name="notes" rows={4} defaultValue={lead.notes ?? ""} disabled={!team.canEdit} />
            </label>
            {team.canEdit && (
              <button className="btn btn-primary" type="submit">
                Save
              </button>
            )}
          </form>
        </section>

        <section className="card">
          <h2>Summary</h2>
          <p>{lead.summary ?? <span className="muted">No summary for this call.</span>}</p>
        </section>

        <section className="card">
          <h2>Call quality</h2>
          <ul className="checks">
            {checks.map(([key, check]) => (
              <li key={key} className={`check is-${check.result ?? "unknown"}`}>
                <span className="check-mark" aria-hidden="true">
                  {check.result === "success" ? "✓" : check.result === "failure" ? "✕" : "?"}
                </span>
                <div>
                  <p className="check-label">{CHECK_LABELS[key] ?? key}</p>
                  {check.rationale && <p className="muted small">{check.rationale}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="muted small">
        Conversation <code>{lead.conversation_id}</code>. The full transcript and recording are in
        the ElevenLabs dashboard.
      </p>
    </>
  );
}
