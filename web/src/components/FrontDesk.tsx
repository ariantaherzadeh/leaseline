"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { type ClientTools, ConvaiWidget, startWidgetCall } from "@/components/ConvaiWidget";
import { ListingCard } from "@/components/ListingCard";
import type { Site } from "@/lib/site";

type ShowingRequest = {
  listing_id: string;
  name: string;
  contact: string;
  preferred_time: string;
};

type FrontDeskProps = {
  site: Site;
  /** Static, server-rendered parts of the left panel. */
  masthead: ReactNode;
  howItWorks: ReactNode;
};

export function FrontDesk({ site, masthead, howItWorks }: FrontDeskProps) {
  const { persona, listings } = site;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showing, setShowing] = useState<ShowingRequest | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());

  // Client tools: Nora calls these by name mid-conversation. Their names and parameters are
  // declared on the agent by `leaseline deploy` (see ../../src/leaseline/render.py).
  const rememberCall = (params: Record<string, unknown>) => {
    if (typeof params.conversation_id === "string" && params.conversation_id) {
      setConversationId(params.conversation_id);
    }
  };
  const clientTools: ClientTools = {
    show_listing: (params) => {
      rememberCall(params);
      const listing_id = String(params.listing_id ?? "");
      if (!cardRefs.current.has(listing_id)) return `No listing ${listing_id} is on the page.`;
      setActiveId(listing_id);
      return "The home is highlighted on the renter's screen.";
    },
    show_showing_request: (params) => {
      rememberCall(params);
      const field = (key: keyof ShowingRequest) => String(params[key] ?? "");
      setShowing({
        listing_id: field("listing_id"),
        name: field("name"),
        contact: field("contact"),
        preferred_time: field("preferred_time"),
      });
      return "The confirmation is showing on the renter's screen.";
    },
  };

  useEffect(() => {
    if (!activeId) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRefs.current
      .get(activeId)
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }, [activeId]);

  const registerCard = useCallback((id: string, el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const active = listings.find((l) => l.id === activeId);
  const showingHome = listings.find((l) => l.id === showing?.listing_id)?.title ?? "the home";

  return (
    <div className="desk">
      <section className="panel" aria-labelledby="hero-title">
        {masthead}
        <h1 id="hero-title">
          Tell {persona.name} what you need. Get matched with the home that fits.
        </h1>
        <p className="lede">
          {persona.name} is an AI leasing assistant. Talk through your budget, parking, pets and
          move-in date out loud, and {persona.name} recommends a home, answers questions, and books
          a showing with {site.team.name}.
        </p>
        <div className="cta-row">
          <button className="cta" type="button" onClick={startWidgetCall}>
            <span className="cta-dot" aria-hidden="true" />
            Talk to {persona.name}
          </button>
          <p className="cta-note">Uses your microphone. Calls last up to five minutes.</p>
        </div>
        {conversationId && <TeamLink conversationId={conversationId} />}
        {howItWorks}
      </section>

      <section className="homes" id="homes" aria-labelledby="homes-title">
        <div className="homes-head">
          <h2 id="homes-title">Available now in {site.team.city}</h2>
          <p className="live-status" role="status" aria-live="polite">
            {active ? `Now discussing: ${active.title}` : ""}
          </p>
        </div>
        <ul className={`listing-grid${active ? " has-active" : ""}`}>
          {listings.map((listing) => (
            <li key={listing.id}>
              <ListingCard
                listing={listing}
                personaName={persona.name}
                active={listing.id === activeId}
                ref={(el) => registerCard(listing.id, el)}
              />
            </li>
          ))}
        </ul>
      </section>

      {showing && (
        <aside className="showing" aria-live="assertive" aria-labelledby="showing-title">
          <h2 id="showing-title">Showing requested</h2>
          <p>
            {showing.name}, for {showingHome}, {showing.preferred_time}. We&rsquo;ll contact you at{" "}
            {showing.contact}.
          </p>
          <p className="showing-follow">{site.followUp}</p>
          <TeamLink conversationId={conversationId} compact />
          <button type="button" className="showing-close" onClick={() => setShowing(null)}>
            Close
          </button>
        </aside>
      )}

      <ConvaiWidget
        agentId={site.agentId}
        clientTools={clientTools}
        onCallStart={() => {
          setActiveId(null);
          setShowing(null);
          setConversationId(null);
        }}
      />
    </div>
  );
}

/** The door to the back office: what the leasing team gets from this renter's call. */
function TeamLink({
  conversationId,
  compact = false,
}: {
  conversationId: string | null;
  compact?: boolean;
}) {
  if (!conversationId) return null;
  const href = `/team?c=${encodeURIComponent(conversationId)}`;
  if (compact) {
    return (
      <a className="team-link-inline" href={href} target="_blank" rel="noopener">
        See what the leasing team receives
      </a>
    );
  }
  return (
    <aside className="team-link" aria-label="Leasing team view">
      <p className="team-link-title">This call is being screened</p>
      <p>
        When you hang up, open the leasing team&rsquo;s back office to see the lead, summary and
        call-quality checks generated from your conversation.
      </p>
      <a href={href} target="_blank" rel="noopener">
        Open the leasing team view
      </a>
    </aside>
  );
}
