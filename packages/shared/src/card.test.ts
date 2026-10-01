import assert from "node:assert/strict";
import { test } from "node:test";

import { type ListingRow, toListingCard } from "./card.ts";

const gladstone = {
  slug: "gladstone-920-1",
  title: "920 Gladstone Ave, Unit 1",
  neighbourhood: "Little Italy",
  rent_monthly: 2695,
  beds: 2,
  baths: 1,
  sqft: "700",
  available_now: true,
  available_on: null,
  pets: "Pet friendly",
  laundry: "In-unit",
  cooling: "None",
  parking_spots: 2,
  parking_type: "driveway",
  utilities_included: ["heat", "water"],
  highlights: ["Fully renovated", "Bright", "Large backyard", "Two spots"],
} as unknown as ListingRow;

// Same expectations as the Python site export these cards replaced.
test("formats a card like the original site", () => {
  const card = toListingCard(gladstone, "Nora");
  assert.equal(card.rent, "$2,695");
  assert.equal(card.layout, "2 bed, 1 bath");
  assert.deepEqual(card.stats, [
    { value: "2", label: "bds" },
    { value: "1", label: "ba" },
    { value: "700", label: "sqft" },
  ]);
  assert.deepEqual(card.tags, ["Available now", "Pet friendly", "2 parking", "Heat & water included", "In-unit laundry"]);
  assert.deepEqual(Object.fromEntries(card.facts.map((f) => [f.label, f.value])), {
    Size: "700 sq ft",
    Available: "Now",
    Pets: "Pet friendly",
    Parking: "2 driveway",
    Included: "Heat, water",
    Cooling: "None",
  });
  assert.equal(card.highlights.length, 3);
});

test("unconfirmed facts are labelled and never become tags", () => {
  const card = toListingCard(
    { ...gladstone, available_now: false, sqft: null, pets: "Allowed with restrictions", parking_spots: null, utilities_included: [] },
    "Nora",
  );
  const facts = Object.fromEntries(card.facts.map((f) => [f.label, f.value]));
  assert.equal(facts.Available, "To be confirmed");
  assert.equal(facts.Size, "To be confirmed");
  assert.equal(facts.Parking, "To be confirmed");
  assert.equal(facts.Included, "Ask Nora");
  assert.ok(!card.tags.includes("Pet friendly"));
  assert.ok(!card.tags.includes("Available now"));
  assert.ok(!card.stats.some((s) => s.label === "sqft"));
});

test("dated availability", () => {
  const card = toListingCard({ ...gladstone, available_now: false, available_on: "2026-11-01" }, "Nora");
  assert.equal(card.facts.find((f) => f.label === "Available")?.value, "November 1, 2026");
});
