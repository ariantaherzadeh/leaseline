// Types for the data exported by `leaseline export-site` (see ../../src/leaseline/site.py).
import data from "@/data/site.json";

export type Fact = { label: string; value: string };

export type Listing = {
  id: string;
  title: string;
  neighbourhood: string;
  rent: string;
  layout: string;
  highlights: string[];
  facts: Fact[];
};

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
