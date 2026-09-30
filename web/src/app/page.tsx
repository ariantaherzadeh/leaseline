import Link from "next/link";

import { FrontDesk } from "@/components/FrontDesk";
import { site } from "@/lib/site";

export default function Home() {
  const { persona, team, brand } = site;

  const masthead = (
    <header className="masthead">
      <Link className="wordmark" href="/" aria-label="LeaseLine home">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="11" cy="16" r="5.5" />
          <path d="M16.5 16H27M23 16v4M26.5 16v3" />
        </svg>
        LeaseLine
      </Link>
      {brand.coBrand && <p className="co-brand">{brand.coBrand}</p>}
    </header>
  );

  const howItWorks = (
    <div className="steps">
      <h2>How it works</h2>
      <ol>
        <li>
          <strong>Describe what you&rsquo;re looking for.</strong> Budget, bedrooms, parking, pets,
          and the way you like to live.
        </li>
        <li>
          <strong>{persona.name} recommends a residence.</strong> It&rsquo;s highlighted here as{" "}
          {persona.name} explains why it suits you.
        </li>
        <li>
          <strong>Arrange a private showing.</strong> Leave your name and number, and {team.name}{" "}
          will be in touch.
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
