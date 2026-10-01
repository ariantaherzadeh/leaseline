"use client";

import { useActionState } from "react";

import { type LoginState, sendMagicLink } from "./actions";

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <div className="notice" role="status">
        <p className="notice-title">Check your email</p>
        <p>
          If <strong>{state.message}</strong> is on a LeaseLine team, a sign-in link is on its way.
          Open it in this browser.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="stack">
      {linkError && (
        <p className="form-error" role="alert">
          That sign-in link expired or was already used. Request a new one.
        </p>
      )}
      <label className="field">
        <span>Work email</span>
        <input name="email" type="email" autoComplete="email" required placeholder="you@brokerage.com" />
      </label>
      {state.status === "error" && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
