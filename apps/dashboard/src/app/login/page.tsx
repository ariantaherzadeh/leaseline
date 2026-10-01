import type { Metadata } from "next";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · LeaseLine for leasing teams" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="login-card">
        <p className="brand">
          LeaseLine <span>for leasing teams</span>
        </p>
        <h1>Sign in</h1>
        <p className="muted">
          We&rsquo;ll email you a one-time link. Access is by invitation from your team&rsquo;s admin.
        </p>
        <LoginForm linkError={error === "link"} />
      </div>
    </main>
  );
}
