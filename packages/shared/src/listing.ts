// Listing validation shared by the dashboard form and its server actions. Mirrors the
// `listings` table (supabase/migrations) and the original Python schema (src/leaseline/models.py).
// An unconfirmed fact is null: the agent says "not confirmed yet" instead of guessing.

import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const list = z
  .string()
  .transform((v) =>
    v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SQFT_PATTERN = /^\d{3,5}(\s*[–-]\s*\d{3,5})?$/;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Form input (all strings, as submitted) → a validated listing row. */
export const listingFormSchema = z
  .object({
    status: z.enum(["draft", "published", "archived"]),
    slug: z.string().trim().regex(SLUG_PATTERN, "Use lowercase letters, numbers and dashes").max(64),
    title: z.string().trim().min(3, "Add a title").max(120),
    street: z.string().trim().min(1, "Add the street address"),
    unit: optionalText,
    city: z.string().trim().min(1, "Add the city"),
    province: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Two-letter province code, e.g. ON"),
    postal_code: z.string().trim().min(3, "Add the postal code"),
    neighbourhood: z.string().trim().min(1, "Add the neighbourhood"),
    property_type: z.string().trim().min(1, "Add the property type"),
    rent_monthly: z.coerce.number().int("Whole dollars").positive("Rent must be above 0"),
    beds: z.coerce.number().int().min(0),
    baths: z.coerce.number().positive().multipleOf(0.5, "Use whole or half baths"),
    sqft: optionalText.refine((v) => v === null || SQFT_PATTERN.test(v), "e.g. 700 or 600–699"),
    availability: z.enum(["now", "date", "unconfirmed"]),
    available_on: optionalText,
    pets: optionalText,
    laundry: optionalText,
    cooling: optionalText,
    heating: optionalText,
    parking_spots: optionalText.transform((v) => (v === null ? null : Number(v))).refine(
      (v) => v === null || (Number.isInteger(v) && v >= 0),
      "Number of spots",
    ),
    parking_type: optionalText,
    utilities_included: list,
    tenant_pays: list,
    amenities: list,
    highlights: list,
    outdoor: optionalText,
    storage: optionalText,
    transit: optionalText,
    description: z.string().trim().max(8000),
    mls_number: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.availability === "date" && !v.available_on) {
      ctx.addIssue({ code: "custom", path: ["available_on"], message: "Pick the date" });
    }
  })
  .transform(({ availability, available_on, ...rest }) => ({
    ...rest,
    available_now: availability === "now",
    available_on: availability === "date" ? available_on : null,
  }));

export type ListingFormValues = z.input<typeof listingFormSchema>;
export type ListingRowInput = z.output<typeof listingFormSchema>;

/** Field errors keyed by field name, for redisplaying the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
