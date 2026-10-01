import Link from "next/link";
import { redirect } from "next/navigation";

import { ListingForm } from "@/components/ListingForm";
import { getTeam } from "@/lib/team";

export default async function NewListingPage() {
  const team = (await getTeam())!;
  if (!team.canEdit) redirect("/listings");
  return (
    <>
      <Link href="/listings" className="back">
        ← All listings
      </Link>
      <div className="page-head">
        <div>
          <h1>Add a listing</h1>
          <p className="muted">Save as a draft first if you want to check it before it goes live.</p>
        </div>
      </div>
      <ListingForm canEdit />
    </>
  );
}
