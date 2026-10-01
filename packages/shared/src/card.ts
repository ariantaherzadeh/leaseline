// Turn a listings row into what the public site's card shows. Unconfirmed facts (NULL) are
// labelled, never guessed, and feature tags only come from confirmed facts.

import type { Tables } from "./database.types";
import type { Fact, ListingCard, Stat } from "./index";

export type ListingRow = Tables<"listings">;

export const TO_BE_CONFIRMED = "To be confirmed";

const longDate = new Intl.DateTimeFormat("en-CA", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function fact(value: string | null, suffix = ""): string {
  return value === null || value === "" ? TO_BE_CONFIRMED : `${value}${suffix}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n));
}

export function availability(row: ListingRow): string {
  if (row.available_now) return "Now";
  if (row.available_on) return longDate.format(new Date(`${row.available_on}T00:00:00Z`));
  return TO_BE_CONFIRMED;
}

export function stats(row: ListingRow): Stat[] {
  const out: Stat[] = [
    { value: String(row.beds), label: row.beds === 1 ? "bd" : "bds" },
    { value: num(Number(row.baths)), label: "ba" },
  ];
  if (row.sqft) out.push({ value: row.sqft, label: "sqft" });
  return out;
}

export function tags(row: ListingRow): string[] {
  const out: string[] = [];
  if (row.available_now) out.push("Available now");
  if (row.pets && row.pets.toLowerCase().startsWith("pet friendly")) out.push("Pet friendly");
  if (row.parking_spots) out.push(`${row.parking_spots} parking`);
  if (row.utilities_included.length) out.push(`${capitalize(row.utilities_included.join(" & "))} included`);
  if (row.laundry && row.laundry.toLowerCase().includes("in")) out.push("In-unit laundry");
  if (row.cooling && row.cooling.toLowerCase() !== "none") out.push("A/C");
  return out;
}

export function toListingCard(row: ListingRow, personaName: string): ListingCard {
  const parking =
    row.parking_spots === null
      ? TO_BE_CONFIRMED
      : row.parking_spots === 0
        ? "None"
        : `${row.parking_spots} ${row.parking_type ?? "spot"}`;
  const facts: Fact[] = [
    { label: "Size", value: fact(row.sqft, " sq ft") },
    { label: "Available", value: availability(row) },
    { label: "Pets", value: fact(row.pets) },
    { label: "Parking", value: parking },
    {
      label: "Included",
      value: row.utilities_included.length
        ? capitalize(row.utilities_included.join(", "))
        : `Ask ${personaName}`,
    },
    { label: "Cooling", value: fact(row.cooling) },
  ];
  return {
    id: row.slug,
    title: row.title,
    neighbourhood: row.neighbourhood,
    rent: `$${row.rent_monthly.toLocaleString("en-US")}`,
    layout: `${row.beds} bed, ${num(Number(row.baths))} bath`,
    stats: stats(row),
    tags: tags(row),
    highlights: row.highlights.slice(0, 3),
    facts,
  };
}
