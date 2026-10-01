// Tenant branding and assistant settings, exported by `leaseline export-site`
// (src/leaseline/site.py). Listings are not in here: see listings.ts.
import data from "@/data/site.json";

import type { ListingCard } from "@leaseline/shared";

export type { Fact, Stat } from "@leaseline/shared";
export type Listing = ListingCard;

export type Site = {
  siteUrl: string;
  tenantSlug: string;
  agentId: string;
  persona: { name: string };
  team: { name: string; city: string };
  brand: { accent: string; coBrand: string | null };
  followUp: string;
};

export const site: Site = data;
