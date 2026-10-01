// Types shared by the public site (apps/site) and the dashboard (apps/dashboard).

export type Fact = { label: string; value: string };
export type Stat = { value: string; label: string };

/** A listing as the site renders it: display-ready values, unconfirmed facts already labelled. */
export type ListingCard = {
  id: string;
  title: string;
  neighbourhood: string;
  rent: string;
  layout: string;
  stats: Stat[];
  tags: string[];
  highlights: string[];
  facts: Fact[];
};

export type { Database, Enums, Json, Tables, TablesInsert, TablesUpdate } from "./database.types";
export { Constants } from "./database.types";
