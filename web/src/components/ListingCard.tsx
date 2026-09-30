import type { Ref } from "react";

import type { Listing } from "@/lib/site";

type Props = {
  listing: Listing;
  personaName: string;
  active: boolean;
  ref?: Ref<HTMLElement>;
};

export function ListingCard({ listing, personaName, active, ref }: Props) {
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
      <div className="listing-head">
        <p className="rent">
          <span className="rent-amount">{listing.rent}</span> a month
        </p>
        <p className="beds">{listing.layout}</p>
      </div>
      <h3 id={titleId}>{listing.title}</h3>
      <p className="hood">{listing.neighbourhood}</p>
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
