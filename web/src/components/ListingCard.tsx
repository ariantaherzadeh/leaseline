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
        {personaName} is presenting this residence
      </p>
      <div className="listing-intro">
        <p className="hood">{listing.neighbourhood}</p>
        <h3 id={titleId}>{listing.title}</h3>
        <div className="listing-head">
          <p className="rent">
            <span className="rent-amount">{listing.rent}</span> per month
          </p>
          <p className="beds">{listing.layout}</p>
        </div>
        <ul className="highlights">
          {listing.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>
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
