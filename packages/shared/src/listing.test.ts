import assert from "node:assert/strict";
import { test } from "node:test";

import { listingFormSchema, slugify } from "./listing.ts";

const valid = {
  status: "published",
  slug: "300-somerset-4",
  title: "300 Somerset St, Unit 4",
  street: "300 Somerset St",
  unit: "4",
  city: "Ottawa",
  province: "on",
  postal_code: "K2P 0J9",
  neighbourhood: "Centretown",
  property_type: "Apartment",
  rent_monthly: "2100",
  beds: "1",
  baths: "1",
  sqft: "",
  availability: "unconfirmed",
  available_on: "",
  pets: "Cats only",
  laundry: "",
  cooling: "",
  heating: "",
  parking_spots: "",
  parking_type: "",
  utilities_included: "heat\n water \n\n",
  tenant_pays: "hydro",
  amenities: "",
  highlights: "Bright\nQuiet street",
  outdoor: "",
  storage: "",
  transit: "",
  description: "  A bright one-bedroom.  ",
  mls_number: "",
};

test("turns form strings into a listing row", () => {
  const row = listingFormSchema.parse(valid);
  assert.equal(row.province, "ON");
  assert.equal(row.rent_monthly, 2100);
  assert.deepEqual(row.utilities_included, ["heat", "water"]);
  assert.deepEqual(row.amenities, []);
  assert.equal(row.description, "A bright one-bedroom.");
});

test("blank optional facts become null (not confirmed), never empty strings", () => {
  const row = listingFormSchema.parse(valid);
  assert.equal(row.sqft, null);
  assert.equal(row.laundry, null);
  assert.equal(row.parking_spots, null);
  assert.equal(row.available_now, false);
  assert.equal(row.available_on, null);
});

test("availability: now, a date, or unconfirmed", () => {
  assert.equal(listingFormSchema.parse({ ...valid, availability: "now" }).available_now, true);
  const dated = listingFormSchema.parse({ ...valid, availability: "date", available_on: "2026-11-01" });
  assert.equal(dated.available_on, "2026-11-01");
  assert.equal(dated.available_now, false);
  assert.equal(listingFormSchema.safeParse({ ...valid, availability: "date" }).success, false);
});

test("rejects bad values", () => {
  for (const bad of [
    { rent_monthly: "0" },
    { province: "Ontario" },
    { slug: "Bad Slug" },
    { sqft: "big" },
    { baths: "1.3" },
    { parking_spots: "-1" },
  ]) {
    assert.equal(listingFormSchema.safeParse({ ...valid, ...bad }).success, false, JSON.stringify(bad));
  }
  assert.equal(listingFormSchema.safeParse({ ...valid, sqft: "600–699" }).success, true);
});

test("slugify makes URL names from titles", () => {
  assert.equal(slugify("The Icon, 805 Carling Ave, Unit 1105"), "the-icon-805-carling-ave-unit-1105");
  assert.equal(slugify("  Café   Ouest!! "), "cafe-ouest");
});
