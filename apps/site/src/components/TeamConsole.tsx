"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { TeamView } from "@/lib/conversation";

const POLL_MS = 3000;
const GIVE_UP_AFTER_MS = 3 * 60 * 1000;

type State =
  | { kind: "loading" }
  | { kind: "waiting"; view: TeamView | null }
  | { kind: "ready"; view: TeamView }
  | { kind: "error"; message: string };

function formatDuration(secs: number | null) {
  if (secs === null) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m ? `${m} min ${s} s` : `${s} s`;
}

export function TeamConsole({
  conversationId,
  personaName,
}: {
  conversationId: string | null;
  personaName: string;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();

    const load = async () => {
      try {
        const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`, {
          cache: "no-store",
        });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) return setState({ kind: "error", message: body.error });
        const view = body as TeamView;
        if (view.status === "done" || view.status === "failed") {
          return setState({ kind: "ready", view });
        }
        setState({ kind: "waiting", view });
      } catch {
        if (!cancelled) setState({ kind: "waiting", view: null });
      }
      if (Date.now() - started < GIVE_UP_AFTER_MS) timer = setTimeout(load, POLL_MS);
      else setState({ kind: "error", message: "The call is taking longer than usual to process." });
    };

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [conversationId]);

  if (!conversationId) {
    return (
      <section className="panel-card empty">
        <h1>No call to show yet</h1>
        <p>
          Talk to {personaName} on the <Link href="/">renter site</Link> first. When the call has
          started, a link to this view appears there.
        </p>
      </section>
    );
  }

  if (state.kind === "loading") return <p className="console-status">Loading the call…</p>;

  if (state.kind === "error") {
    return (
      <section className="panel-card empty">
        <h1>Couldn&rsquo;t load this call</h1>
        <p>{state.message}</p>
      </section>
    );
  }

  if (state.kind === "waiting") {
    const live = state.view?.status === "in-progress" || state.view?.status === "initiated";
    return (
      <section className="panel-card empty" aria-live="polite">
        <h1>{live ? "The call is still going" : "Screening the call"}</h1>
        <p>
          {live
            ? `End the call with ${personaName} and the results appear here automatically.`
            : "ElevenLabs is analysing the conversation. This usually takes under a minute."}
        </p>
        <div className="pulse" aria-hidden="true" />
      </section>
    );
  }

  const { view } = state;
  const passed = view.checks.filter((c) => c.result === "success").length;

  return (
    <div className="results">
      <section className="panel-card lead" aria-labelledby="lead-title">
        <p className="card-kicker">New lead</p>
        <h1 id="lead-title">{view.lead.find((f) => f.label === "Name")?.value ?? "Unnamed renter"}</h1>
        <p className="lead-meta">
          <span>{view.title}</span>
          {view.durationSecs !== null && <span>{formatDuration(view.durationSecs)} call</span>}
        </p>
        {view.recommendedHome && (
          <p className="lead-home">
            Recommended: <strong>{view.recommendedHome}</strong>
          </p>
        )}
        {view.lead.length > 0 ? (
          <dl className="lead-facts">
            {view.lead
              .filter((f) => f.label !== "Name")
              .map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
          </dl>
        ) : (
          <p className="muted">The renter didn&rsquo;t share screening details on this call.</p>
        )}
      </section>

      <section className="panel-card" aria-labelledby="summary-title">
        <h2 id="summary-title">Summary</h2>
        <p>{view.summary ?? "No summary was produced for this call."}</p>
      </section>

      <section className="panel-card" aria-labelledby="checks-title">
        <h2 id="checks-title">
          Call quality <span className="muted">{passed} of {view.checks.length} passed</span>
        </h2>
        <ul className="checks">
          {view.checks.map((c) => (
            <li key={c.id} className={`check is-${c.result}`}>
              <span className="check-mark" aria-hidden="true">
                {c.result === "success" ? "✓" : c.result === "failure" ? "✕" : "?"}
              </span>
              <div>
                <p className="check-label">
                  {c.label}
                  <span className="visually-hidden">: {c.result}</span>
                </p>
                <p className="check-why">{c.rationale}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-card transcript-card" aria-labelledby="transcript-title">
        <details>
          <summary>
            <h2 id="transcript-title">Transcript</h2>
            <span className="muted">{view.transcript.length} turns</span>
          </summary>
          <ol className="transcript">
            {view.transcript.map((t, i) => (
              <li key={i} className={`turn is-${t.role}`}>
                <span className="turn-who">{t.role === "agent" ? personaName : "Renter"}</span>
                <p>{t.message}</p>
              </li>
            ))}
          </ol>
        </details>
      </section>
    </div>
  );
}
