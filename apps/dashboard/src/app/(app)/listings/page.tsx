import Link from "next/link";

import { formatMoney, formatWhen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getTeam } from "@/lib/team";

export default async function ListingsPage({ searchParams }: PageProps<"/listings">) {
  const { saved, deleted } = await searchParams;
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
          <p className="muted">
            Published listings appear on your site, and your assistant learns them within a few
            minutes.
          </p>
        </div>
        {team.canEdit && (
          <Link href="/listings/new" className="btn btn-primary">
            Add listing
          </Link>
        )}
      </div>

      {saved && (
        <p className="notice" role="status">
          Listing saved.
        </p>
      )}
      {deleted && (
        <p className="notice" role="status">
          Listing deleted.
        </p>
      )}

      {listings && listings.length === 0 ? (
        <div className="empty">
          <h2>No listings yet</h2>
          <p className="muted">Add your first home and your assistant can start recommending it.</p>
        </div>
      ) : (
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
                <tr key={l.id} className={saved === l.id ? "is-highlighted" : undefined}>
                  <td>
                    <Link href={`/listings/${l.id}`} className="row-link">
                      {l.title}
                    </Link>
                  </td>
                  <td>{l.neighbourhood}</td>
                  <td>{formatMoney(l.rent_monthly)}/mo</td>
                  <td className="nowrap">
                    {l.beds} bd, {Number(l.baths)} ba
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
      )}
    </>
  );
}
