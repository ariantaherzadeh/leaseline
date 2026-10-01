import { formatMoney, formatWhen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getTeam } from "@/lib/team";

export default async function ListingsPage() {
  const team = (await getTeam())!;
  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("listings")
    .select("id, slug, title, status, rent_monthly, beds, baths, neighbourhood, updated_at")
    .eq("tenant_id", team.tenant.id)
    .order("status")
    .order("updated_at", { ascending: false });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Listings</h1>
          <p className="muted">Published listings appear on your site and your assistant knows them.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Home</th>
              <th>Neighbourhood</th>
              <th>Rent</th>
              <th>Size</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {listings?.map((l) => (
              <tr key={l.id}>
                <td>{l.title}</td>
                <td>{l.neighbourhood}</td>
                <td>{formatMoney(l.rent_monthly)}/mo</td>
                <td className="nowrap">
                  {l.beds} bd · {Number(l.baths)} ba
                </td>
                <td>
                  <span className={`badge badge-${l.status}`}>{l.status}</span>
                </td>
                <td className="nowrap">{formatWhen(l.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
