"use client";

import { type Tables, slugify } from "@leaseline/shared";
import { useActionState, useState } from "react";

import { type ListingFormState, saveListing } from "@/app/(app)/listings/actions";

type Listing = Tables<"listings">;

const UNCONFIRMED = "Leave blank if not confirmed. Your assistant will say so instead of guessing.";

function initialValues(listing?: Listing): Record<string, string> {
  if (!listing) {
    return { status: "draft", city: "Ottawa", province: "ON", availability: "unconfirmed" };
  }
  const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    id: listing.id,
    status: listing.status,
    slug: listing.slug,
    title: listing.title,
    street: listing.street,
    unit: text(listing.unit),
    city: listing.city,
    province: listing.province,
    postal_code: listing.postal_code,
    neighbourhood: listing.neighbourhood,
    property_type: listing.property_type,
    rent_monthly: text(listing.rent_monthly),
    beds: text(listing.beds),
    baths: text(listing.baths),
    sqft: text(listing.sqft),
    availability: listing.available_now ? "now" : listing.available_on ? "date" : "unconfirmed",
    available_on: text(listing.available_on),
    pets: text(listing.pets),
    laundry: text(listing.laundry),
    cooling: text(listing.cooling),
    heating: text(listing.heating),
    parking_spots: text(listing.parking_spots),
    parking_type: text(listing.parking_type),
    utilities_included: listing.utilities_included.join("\n"),
    tenant_pays: listing.tenant_pays.join("\n"),
    amenities: listing.amenities.join("\n"),
    highlights: listing.highlights.join("\n"),
    outdoor: text(listing.outdoor),
    storage: text(listing.storage),
    transit: text(listing.transit),
    description: listing.description,
    mls_number: text(listing.mls_number),
  };
}

export function ListingForm({ listing, canEdit }: { listing?: Listing; canEdit: boolean }) {
  const [state, action, pending] = useActionState<ListingFormState, FormData>(saveListing, {
    errors: {},
  });
  const v = state.values ?? initialValues(listing);
  const e = state.errors;
  const [slugTouched, setSlugTouched] = useState(Boolean(listing));
  const [slug, setSlug] = useState(v.slug ?? "");
  const [availability, setAvailability] = useState(v.availability ?? "unconfirmed");

  const field = (
    name: string,
    label: string,
    opts: { type?: string; hint?: string; required?: boolean; placeholder?: string; step?: string } = {},
  ) => (
    <label className="field">
      <span>
        {label}
        {opts.required && " *"}
      </span>
      <input
        name={name}
        type={opts.type ?? "text"}
        defaultValue={v[name] ?? ""}
        required={opts.required}
        placeholder={opts.placeholder}
        step={opts.step}
        aria-invalid={Boolean(e[name])}
        disabled={!canEdit}
      />
      {e[name] ? <em className="form-error">{e[name]}</em> : opts.hint && <em className="hint">{opts.hint}</em>}
    </label>
  );

  const lines = (name: string, label: string, hint: string) => (
    <label className="field">
      <span>{label}</span>
      <textarea name={name} rows={3} defaultValue={v[name] ?? ""} disabled={!canEdit} />
      <em className="hint">{hint}</em>
    </label>
  );

  return (
    <form action={action} className="listing-form">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {e.form && (
        <p className="form-error banner" role="alert">
          {e.form}
        </p>
      )}

      <section className="card">
        <h2>Basics</h2>
        <div className="form-grid">
          <label className="field span-2">
            <span>Title *</span>
            <input
              name="title"
              defaultValue={v.title ?? ""}
              required
              placeholder="920 Gladstone Ave, Unit 1"
              disabled={!canEdit}
              onChange={(ev) => !slugTouched && setSlug(slugify(ev.target.value))}
            />
            {e.title && <em className="form-error">{e.title}</em>}
          </label>
          <label className="field">
            <span>URL name *</span>
            <input
              name="slug"
              value={slug}
              required
              disabled={!canEdit}
              onChange={(ev) => {
                setSlugTouched(true);
                setSlug(ev.target.value);
              }}
            />
            {e.slug ? <em className="form-error">{e.slug}</em> : <em className="hint">Used by your assistant to refer to this home.</em>}
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={v.status} disabled={!canEdit}>
              <option value="draft">Draft (only your team sees it)</option>
              <option value="published">Published (on your site and known to your assistant)</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          {field("property_type", "Property type", { required: true, placeholder: "Condo apartment" })}
          {field("neighbourhood", "Neighbourhood", { required: true, placeholder: "Little Italy" })}
        </div>
      </section>

      <section className="card">
        <h2>Address</h2>
        <div className="form-grid">
          {field("street", "Street", { required: true })}
          {field("unit", "Unit")}
          {field("city", "City", { required: true })}
          {field("province", "Province", { required: true, placeholder: "ON" })}
          {field("postal_code", "Postal code", { required: true })}
          {field("mls_number", "MLS® number")}
        </div>
      </section>

      <section className="card">
        <h2>Price and size</h2>
        <div className="form-grid">
          {field("rent_monthly", "Rent per month ($)", { type: "number", required: true })}
          {field("beds", "Bedrooms", { type: "number", required: true })}
          {field("baths", "Bathrooms", { type: "number", required: true, step: "0.5" })}
          {field("sqft", "Size (sq ft)", { placeholder: "700 or 600–699", hint: UNCONFIRMED })}
        </div>
      </section>

      <section className="card">
        <h2>Availability</h2>
        <fieldset className="radios" disabled={!canEdit}>
          {[
            ["now", "Available now"],
            ["date", "From a date"],
            ["unconfirmed", "Not confirmed yet"],
          ].map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="availability"
                value={value}
                checked={availability === value}
                onChange={() => setAvailability(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {availability === "date" && (
          <div className="form-grid">{field("available_on", "Available from", { type: "date" })}</div>
        )}
      </section>

      <section className="card">
        <h2>Features</h2>
        <p className="muted small">{UNCONFIRMED}</p>
        <div className="form-grid">
          {field("pets", "Pets", { placeholder: "Pet friendly / Cats only / No pets" })}
          {field("laundry", "Laundry", { placeholder: "In-unit" })}
          {field("parking_spots", "Parking spots", { type: "number" })}
          {field("parking_type", "Parking type", { placeholder: "Underground" })}
          {field("cooling", "Cooling", { placeholder: "Central air / None" })}
          {field("heating", "Heating", { placeholder: "Forced air (natural gas)" })}
          {field("outdoor", "Outdoor space", { placeholder: "Balcony" })}
          {field("storage", "Storage", { placeholder: "Storage locker" })}
          {field("transit", "Transit", { placeholder: "5-minute walk to the O-Train" })}
        </div>
        <div className="form-grid">
          {lines("utilities_included", "Utilities included", "One per line, e.g. heat")}
          {lines("tenant_pays", "Tenant pays", "One per line, e.g. hydro")}
          {lines("amenities", "Building amenities", "One per line")}
          {lines("highlights", "Highlights", "One per line; the first three show on the listing card")}
        </div>
      </section>

      <section className="card">
        <h2>Description</h2>
        <label className="field">
          <span>What your assistant should know</span>
          <textarea name="description" rows={10} defaultValue={v.description ?? ""} disabled={!canEdit} />
          <em className="hint">
            Plain language works best: what the home is like, who it suits (by needs, never by who
            someone is), and honest trade-offs.
          </em>
        </label>
      </section>

      {canEdit && (
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Saving…" : listing ? "Save changes" : "Add listing"}
          </button>
        </div>
      )}
    </form>
  );
}
