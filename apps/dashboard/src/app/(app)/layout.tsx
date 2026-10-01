import { Nav } from "@/components/Nav";
import { getTeam } from "@/lib/team";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const team = await getTeam();

  return (
    <div className="shell">
      <header className="topbar">
        <p className="brand">
          LeaseLine <span>for leasing teams</span>
        </p>
        {team && <Nav />}
        <div className="topbar-user">
          {team && (
            <span className="muted">
              {team.tenant.name} · {team.email}
            </span>
          )}
          <form action="/auth/signout" method="post">
            <button className="btn btn-ghost" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="page">
        {team ? (
          children
        ) : (
          <div className="empty">
            <h1>No team access yet</h1>
            <p className="muted">
              You&rsquo;re signed in, but not a member of a leasing team. Ask your team&rsquo;s admin
              to add you.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
