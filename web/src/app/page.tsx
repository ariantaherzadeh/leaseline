import Link from "next/link";

import { FrontDesk } from "@/components/FrontDesk";
import { site } from "@/lib/site";

export default function Home() {
  const { persona, team, brand } = site;

  const masthead = (
    <header className="masthead">
      <Link className="wordmark" href="/" aria-label="LeaseLine home">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="12" cy="16" r="5" />
          <path d="M17 16h9M22 16v4" />
        </svg>
        LeaseLine
      </Link>
      {brand.coBrand && <p className="co-brand">{brand.coBrand}</p>}
    </header>
  );

  const howItWorks = (
    <div className="steps">
      <h2>How a call goes</h2>
      <ol>
        <li>
          <strong>Say what you&rsquo;re after.</strong> Budget, bedrooms, cars, pets, the feel you
          want.
        </li>
        <li>
          <strong>{persona.name} picks a home and explains why.</strong> Its card lights up here.
        </li>
        <li>
          <strong>Book a showing.</strong> Leave a name and number; {team.name} follows up.
        </li>
      </ol>
    </div>
  );

  return (
    <>
      <a className="skip" href="#homes">
        Skip to homes
      </a>
      <main>
        <FrontDesk site={site} masthead={masthead} howItWorks={howItWorks} />
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
