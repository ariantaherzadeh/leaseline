"use client";

import { useState, useTransition } from "react";

import { extractListing } from "@/app/(app)/listings/actions";
import { ListingForm } from "@/components/ListingForm";

export function NewListing() {
  const [text, setText] = useState("");
  const [prefill, setPrefill] = useState<Record<string, string>>();
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const fill = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await extractListing(text);
      if (result.values) {
        setPrefill(result.values);
        setVersion((n) => n + 1); // remount the form with the new defaults
      } else {
        setError(result.error);
      }
    });

  return (
    <>
      <section className="card paste">
        <h2>Paste a listing (optional)</h2>
        <p className="muted small">
          Paste the MLS description, an email or your notes, and the form fills itself for you to
          review. Anything the text doesn&rsquo;t state stays blank (not confirmed).
        </p>
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Bright 2-bedroom on the ground floor of a renovated duplex in Little Italy…"
        />
        <div className="paste-actions">
          <button className="btn btn-secondary" type="button" onClick={fill} disabled={pending || text.trim().length < 40}>
            {pending ? "Reading the listing…" : "Fill the form"}
          </button>
          {prefill && !pending && <span className="muted small">Filled. Check every field before saving.</span>}
          {error && (
            <span className="form-error" role="alert">
              {error}
            </span>
          )}
        </div>
      </section>
      <ListingForm key={version} canEdit prefill={prefill} />
    </>
  );
}
