import Link from "next/link";
import { notFound } from "next/navigation";

import { DeleteListingButton } from "@/components/DeleteListingButton";
import { ListingForm } from "@/components/ListingForm";
import { formatWhen } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { getTeam } from "@/lib/team";

export default async function EditListingPage({ params }: PageProps<"/listings/[id]">) {
  const { id } = await params;
  const team = (await getTeam())!;
  const supabase = await createClient();
  const [{ data: listing }, { data: events }] = await Promise.all([
    supabase.from("listings").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("listing_events")
      .select("id, action, at, changes")
      .eq("listing_id", id)
      .order("at", { ascending: false })
      .limit(20),
  ]);
  if (!listing) notFound();

  return (
    <>
      <Link href="/listings" className="back">
        ← All listings
      </Link>
      <div className="page-head">
        <div>
          <h1>{listing.title}</h1>
          <p className="muted">
            <span className={`badge badge-${listing.status}`}>{listing.status}</span> Last updated{" "}
            {formatWhen(listing.updated_at)}
          </p>
        </div>
        {team.canEdit && <DeleteListingButton id={listing.id} title={listing.title} />}
      </div>

      <ListingForm listing={listing} canEdit={team.canEdit} />

      <section className="card history">
        <h2>History</h2>
        <ul>
          {events?.map((ev) => (
            <li key={ev.id}>
              <span className="muted nowrap">{formatWhen(ev.at)}</span>{" "}
              {ev.action === "updated" && ev.changes
                ? `Changed ${Object.keys(ev.changes as object).join(", ")}`
                : ev.action === "created"
                  ? "Created"
                  : ev.action}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
