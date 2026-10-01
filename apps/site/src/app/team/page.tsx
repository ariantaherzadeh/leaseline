import type { Metadata } from "next";
import Link from "next/link";

import { TeamConsole } from "@/components/TeamConsole";
import { site } from "@/lib/site";

import "./team.css";

export const metadata: Metadata = {
  title: "LeaseLine for leasing teams: call results",
  robots: { index: false },
};

export default async function TeamPage({ searchParams }: PageProps<"/team">) {
  const { c } = await searchParams;
  const conversationId = typeof c === "string" ? c : null;

  return (
    <div className="console">
      <header className="console-bar">
        <p className="console-brand">
          LeaseLine <span>for leasing teams</span>
        </p>
        <Link className="console-back" href="/">
          Back to the renter site
        </Link>
      </header>
      <p className="console-note" role="note">
        This is the back office: what {site.team.name} receives after a renter talks to{" "}
        {site.persona.name}. In a real deployment it&rsquo;s private and lists every lead. In this
        demo you can only open the call you just made.
      </p>
      <main className="console-main">
        <TeamConsole conversationId={conversationId} personaName={site.persona.name} />
      </main>
    </div>
  );
}
