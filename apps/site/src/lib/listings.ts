// Published listings, read from Supabase (the source of truth, edited in the dashboard).
// Uses the publishable key: row-level security only exposes published rows. Cached for a
// minute (ISR), so a listing saved in the dashboard is live on the site within ~60 seconds.
import { type ListingRow, toListingCard } from "@leaseline/shared";

import { type Listing, site } from "@/lib/site";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://lyplhlbjuhsigkurckqx.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_GoSBclQLRWtKdjTJNfIXsw_wXTx1Fgx";

export const LISTINGS_REVALIDATE_SECS = 60;

export async function getListings(): Promise<Listing[]> {
  const params = new URLSearchParams({
    select: "*,tenants!inner(slug)",
    "tenants.slug": `eq.${site.tenantSlug}`,
    status: "eq.published",
    order: "rent_monthly.desc",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?${params}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    next: { revalidate: LISTINGS_REVALIDATE_SECS, tags: ["listings"] },
  });
  if (!res.ok) throw new Error(`Couldn't load listings (${res.status})`);
  const rows = (await res.json()) as ListingRow[];
  return rows.map((row) => toListingCard(row, site.persona.name));
}
