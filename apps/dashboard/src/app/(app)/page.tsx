import Link from "next/link";

import { formatDuration, formatMoney, formatWhen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getTeam } from "@/lib/team";

export default async function LeadsPage() {
  const team = (await getTeam())!;
  const supabase = await createClient();
  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, created_at, status, renter_name, contact, recommended_listing_slug, budget_monthly, preferred_showing_time, duration_secs, title",
    )
    .eq("tenant_id", team.tenant.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const newCount = leads?.filter((l) => l.status === "new").length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Leads</h1>
          <p className="muted">
            Every conversation with your assistant, newest first.
            {newCount > 0 && ` ${newCount} new.`}
          </p>
        </div>
      </div>

      {error && <p className="form-error">Couldn&rsquo;t load leads: {error.message}</p>}

      {leads && leads.length === 0 ? (
        <div className="empty">
          <h2>No leads yet</h2>
          <p className="muted">When a renter talks to your assistant, the call shows up here within a minute.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Renter</th>
                <th>Contact</th>
                <th>Interested in</th>
                <th>Budget</th>
                <th>Showing</th>
                <th>Call</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads?.map((lead) => (
                <tr key={lead.id}>
                  <td className="nowrap">
                    <Link href={`/leads/${lead.id}`} className="row-link">
                      {formatWhen(lead.created_at)}
                    </Link>
                  </td>
                  <td>{lead.renter_name ?? <span className="muted">Not given</span>}</td>
                  <td>{lead.contact ?? <span className="muted">Not given</span>}</td>
                  <td>{lead.recommended_listing_slug ?? <span className="muted">None</span>}</td>
                  <td>{formatMoney(lead.budget_monthly)}</td>
                  <td>{lead.preferred_showing_time}</td>
                  <td className="nowrap">{formatDuration(lead.duration_secs)}</td>
                  <td>
                    <span className={`badge badge-${lead.status}`}>{lead.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
