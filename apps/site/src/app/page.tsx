import Link from "next/link";

import { FrontDesk } from "@/components/FrontDesk";
import { site } from "@/lib/site";

export default function Home() {
  const { persona, team, brand } = site;

  const howItWorks = (
    <div className="steps">
      <h2>How it works</h2>
      <ol>
        <li>
          <strong>Tell {persona.name} what you need.</strong> Budget, bedrooms, parking, pets,
          move-in date.
        </li>
        <li>
          <strong>Get a recommendation.</strong> The best match is highlighted while{" "}
          {persona.name} explains why.
        </li>
        <li>
          <strong>Book a showing.</strong> Leave your name and number; {team.name} follows up.
        </li>
      </ol>
    </div>
  );

  return (
    <>
      <a className="skip" href="#homes">
        Skip to homes
      </a>
      <header className="topbar">
        <Link className="wordmark" href="/" aria-label="LeaseLine home">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" />
            <circle cx="11" cy="16" r="5" />
            <path d="M16 16h10M22 16v4M25.5 16v3" />
          </svg>
          LeaseLine
        </Link>
        {brand.coBrand && <p className="co-brand">{brand.coBrand}</p>}
        <p className="topbar-note">Rentals in {team.city}</p>
      </header>
      <main>
        <FrontDesk site={site} howItWorks={howItWorks} />
      </main>
      <footer className="footer">
        <p>
          {persona.name} is an AI assistant, not a person. Details you share are passed only to{" "}
          {team.name} to arrange a showing. When a detail isn&rsquo;t confirmed, {persona.name} says
          so instead of guessing. LeaseLine is built on ElevenLabs Agents.
        </p>
      </footer>
    </>
  );
}
