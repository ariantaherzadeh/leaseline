// Paste-to-fill: the schema Claude fills and how it maps onto the dashboard's listing form.
// Every field is nullable: "not stated in the text" must come back as null, never a guess.

import { z } from "zod";

export const ExtractedListing = z.object({
  title: z.string().nullable().describe("Short address-style title, e.g. '300 Somerset St, Unit 4'"),
  street: z.string().nullable(),
  unit: z.string().nullable(),
  city: z.string().nullable(),
  province: z.string().nullable().describe("Two-letter code, e.g. ON"),
  postal_code: z.string().nullable(),
  neighbourhood: z.string().nullable(),
  property_type: z.string().nullable().describe("e.g. Condo apartment, Duplex (ground floor)"),
  rent_monthly: z.number().nullable().describe("Monthly rent in dollars"),
  beds: z.number().nullable(),
  baths: z.number().nullable(),
  sqft: z.string().nullable().describe("Exact number like '700' or a range like '600–699'"),
  available: z
    .enum(["now", "date", "unconfirmed"])
    .describe("'now' only if stated as immediately/now; 'date' if a date is given; else 'unconfirmed'"),
  available_on: z.string().nullable().describe("YYYY-MM-DD when available is 'date'"),
  pets: z.string().nullable(),
  laundry: z.string().nullable(),
  cooling: z.string().nullable(),
  heating: z.string().nullable(),
  parking_spots: z.number().nullable(),
  parking_type: z.string().nullable(),
  utilities_included: z.array(z.string()),
  tenant_pays: z.array(z.string()),
  amenities: z.array(z.string()),
  highlights: z.array(z.string()).describe("Up to 4 short selling points stated in the text"),
  outdoor: z.string().nullable(),
  storage: z.string().nullable(),
  transit: z.string().nullable(),
  description: z
    .string()
    .describe(
      "2-3 short paragraphs for the voice assistant: what the home is, who it suits by needs " +
        "(never by who someone is), honest trade-offs. Only facts from the text.",
    ),
  mls_number: z.string().nullable(),
});
export type ExtractedListing = z.infer<typeof ExtractedListing>;

export const SYSTEM_PROMPT = `You turn a rental listing (MLS text, an email, or notes) into structured fields for a leasing team's dashboard.

Rules:
- Use only facts stated in the text. If something isn't stated, return null (or an empty list). Never infer, estimate, or fill typical values: an AI voice assistant will repeat these facts to renters, and a wrong fact is worse than a missing one.
- "Pet friendly", "allowed with restrictions", and "no pets" are different facts; copy the text's meaning.
- Rent is the monthly rent in dollars. Ignore deposits and previous prices.
- For square footage, keep ranges as ranges ("600–699"); don't pick a number inside them.
- Write the description in plain language for someone speaking on the phone. Describe who the home suits by needs (parking for two cars, wants a yard), never by age, family status, or any other personal characteristic.`;

/** Map the extraction onto the dashboard form's string fields (blank = not confirmed). */
export function toFormValues(x: ExtractedListing): Record<string, string> {
  const s = (v: string | number | null) => (v === null ? "" : String(v));
  return {
    title: s(x.title),
    street: s(x.street),
    unit: s(x.unit),
    city: s(x.city),
    province: s(x.province)?.toUpperCase(),
    postal_code: s(x.postal_code),
    neighbourhood: s(x.neighbourhood),
    property_type: s(x.property_type),
    rent_monthly: s(x.rent_monthly),
    beds: s(x.beds),
    baths: s(x.baths),
    sqft: s(x.sqft),
    availability: x.available === "date" && !x.available_on ? "unconfirmed" : x.available,
    available_on: x.available === "date" ? s(x.available_on) : "",
    pets: s(x.pets),
    laundry: s(x.laundry),
    cooling: s(x.cooling),
    heating: s(x.heating),
    parking_spots: s(x.parking_spots),
    parking_type: s(x.parking_type),
    utilities_included: x.utilities_included.join("\n"),
    tenant_pays: x.tenant_pays.join("\n"),
    amenities: x.amenities.join("\n"),
    highlights: x.highlights.slice(0, 4).join("\n"),
    outdoor: s(x.outdoor),
    storage: s(x.storage),
    transit: s(x.transit),
    description: x.description.trim(),
    mls_number: s(x.mls_number),
  };
}
