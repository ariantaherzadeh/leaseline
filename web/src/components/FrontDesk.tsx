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
  /** Static, server-rendered "how it works" for the assistant card. */
  howItWorks: ReactNode;
};

export function FrontDesk({ site, howItWorks }: FrontDeskProps) {
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
      <section className="intro" aria-labelledby="hero-title">
        <h1 id="hero-title">Find your next rental by talking to {persona.name}.</h1>
        <p className="lede">
          {persona.name} is an AI leasing assistant. Describe what you need and get matched with
          the right home, then book a showing, all in one short voice call.
        </p>
        <button className="ask-bar" type="button" onClick={startWidgetCall}>
          <span className="ask-bar-text">
            Tell {persona.name} what you&rsquo;re looking for: budget, bedrooms, parking, pets…
          </span>
          <span className="ask-bar-button">
            <MicIcon />
            Start talking
          </span>
        </button>
      </section>

      <div className="desk-body">
        <section className="homes" id="homes" aria-labelledby="homes-title">
          <div className="homes-head">
            <h2 id="homes-title">
              {listings.length} {listings.length === 1 ? "home" : "homes"} for rent in{" "}
              {site.team.city}
            </h2>
            <p className="live-status" role="status" aria-live="polite">
              {active ? `${persona.name} is talking about ${active.title}` : ""}
            </p>
          </div>
          <ul className={`listing-grid${active ? " has-active" : ""}`}>
            {listings.map((listing) => (
              <li key={listing.id}>
                <ListingCard
                  listing={listing}
                  personaName={persona.name}
                  city={site.team.city}
                  active={listing.id === activeId}
                  ref={(el) => registerCard(listing.id, el)}
                />
              </li>
            ))}
          </ul>
        </section>

        <aside className="assistant" aria-labelledby="assistant-title">
          <div className="assistant-card">
            <div className="assistant-head">
              <span className="assistant-orb" aria-hidden="true" />
              <div>
                <h2 id="assistant-title">Ask {persona.name}</h2>
                <p>AI leasing assistant for {site.team.name}</p>
              </div>
            </div>
            <button className="cta" type="button" onClick={startWidgetCall}>
              <MicIcon />
              Talk to {persona.name}
            </button>
            <p className="cta-note">Voice call in your browser, up to 5 minutes.</p>
            {conversationId && (
              <TeamLink conversationId={conversationId} teamName={site.team.name} />
            )}
            {howItWorks}
          </div>
        </aside>
      </div>

      {showing && (
        <aside className="showing" aria-live="assertive" aria-labelledby="showing-title">
          <h2 id="showing-title">Showing requested</h2>
          <p>
            {showing.name}, for {showingHome}, {showing.preferred_time}. We&rsquo;ll contact you at{" "}
            {showing.contact}.
          </p>
          <p className="showing-follow">{site.followUp}</p>
          <TeamLink conversationId={conversationId} teamName={site.team.name} compact />
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
function MicIcon() {
  return (
    <svg className="mic" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

function TeamLink({
  conversationId,
  teamName,
  compact = false,
}: {
  conversationId: string | null;
  teamName: string;
  compact?: boolean;
}) {
  if (!conversationId) return null;
  const href = `/team?c=${encodeURIComponent(conversationId)}`;
  if (compact) {
    return (
      <a className="team-link-inline" href={href} target="_blank" rel="noopener">
        See what {teamName} receives
      </a>
    );
  }
  return (
    <aside className="team-link" aria-label="Leasing team view">
      <p className="team-link-title">See what {teamName} receives</p>
      <p>
        After you hang up, open the leasing team&rsquo;s view of this call: your details, a
        summary, and a quality review.
      </p>
      <a href={href} target="_blank" rel="noopener">
        Open the leasing team view
      </a>
    </aside>
  );
}
