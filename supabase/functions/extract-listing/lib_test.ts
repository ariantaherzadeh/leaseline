import { assertEquals } from "jsr:@std/assert@1";

import { ExtractedListing, toFormValues } from "./lib.ts";

const base: ExtractedListing = {
  title: "300 Somerset St, Unit 4",
  street: "300 Somerset St",
  unit: "4",
  city: "Ottawa",
  province: "on",
  postal_code: "K2P 0J9",
  neighbourhood: "Centretown",
  property_type: "Apartment",
  rent_monthly: 2100,
  beds: 1,
  baths: 1,
  sqft: null,
  available: "date",
  available_on: "2026-11-01",
  pets: null,
  laundry: "In-unit",
  cooling: null,
  heating: null,
  parking_spots: null,
  parking_type: null,
  utilities_included: ["heat", "water"],
  tenant_pays: ["hydro"],
  amenities: [],
  highlights: ["Bright", "Quiet", "Renovated", "Near transit", "Extra"],
  outdoor: null,
  storage: null,
  transit: null,
  description: "  A bright one-bedroom.  ",
  mls_number: null,
};

Deno.test("maps extraction to form values; nulls stay blank (not confirmed)", () => {
  const v = toFormValues(base);
  assertEquals(v.rent_monthly, "2100");
  assertEquals(v.province, "ON");
  assertEquals(v.sqft, "");
  assertEquals(v.pets, "");
  assertEquals(v.parking_spots, "");
  assertEquals(v.utilities_included, "heat\nwater");
  assertEquals(v.highlights.split("\n").length, 4);
  assertEquals(v.description, "A bright one-bedroom.");
  assertEquals(v.availability, "date");
  assertEquals(v.available_on, "2026-11-01");
});

Deno.test("a date availability without a date becomes unconfirmed", () => {
  const v = toFormValues({ ...base, available_on: null });
  assertEquals(v.availability, "unconfirmed");
  assertEquals(v.available_on, "");
});

Deno.test("schema accepts nulls for unstated facts", () => {
  assertEquals(ExtractedListing.safeParse({ ...base, rent_monthly: null, beds: null }).success, true);
});
