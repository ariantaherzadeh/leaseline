// Types for the data exported by `leaseline export-site` (see src/leaseline/site.py).
import data from "@/data/site.json";

import type { ListingCard } from "@leaseline/shared";

export type { Fact, Stat } from "@leaseline/shared";
export type Listing = ListingCard;

export type Site = {
  siteUrl: string;
  agentId: string;
  persona: { name: string };
  team: { name: string; city: string };
  brand: { accent: string; coBrand: string | null };
  followUp: string;
  listings: Listing[];
};

export const site: Site = data;
