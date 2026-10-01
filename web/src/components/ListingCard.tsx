import type { Ref } from "react";

import type { Listing } from "@/lib/site";

type Props = {
  listing: Listing;
  personaName: string;
  city: string;
  active: boolean;
  ref?: Ref<HTMLElement>;
};

export function ListingCard({ listing, personaName, city, active, ref }: Props) {
  const titleId = `title-${listing.id}`;
  return (
    <article
      ref={ref}
      className={`listing${active ? " is-active" : ""}`}
      id={`listing-${listing.id}`}
      aria-labelledby={titleId}
      aria-current={active ? "true" : undefined}
    >
      <p className="tag" aria-hidden="true">
        {personaName} is talking about this home
      </p>
      <p className="price">
        {listing.rent}
        <span>/mo</span>
      </p>
      <ul className="stats" aria-label="Size">
        {listing.stats.map((s) => (
          <li key={s.label}>
            <strong>{s.value}</strong> {s.label}
          </li>
        ))}
      </ul>
      <h3 id={titleId}>{listing.title}</h3>
      <p className="hood">
        {listing.neighbourhood}, {city}
      </p>
      {listing.tags.length > 0 && (
        <ul className="chips" aria-label="Features">
          {listing.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      <ul className="highlights">
        {listing.highlights.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <dl className="facts">
        {listing.facts.map((f) => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
