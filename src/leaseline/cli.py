"""Command-line interface: `leaseline <command> --tenant <slug>`."""

import os
from pathlib import Path

import typer
from dotenv import load_dotenv

from leaseline import __version__
from leaseline.deploy import DeployError, apply_plan, check_plan, make_plan, record_agent_id
from leaseline.loader import ValidationReport, validate_tenant
from leaseline.render import AGENT_DIR, render_agent, write_build
from leaseline.site import SiteError, export_site
from leaseline.supabase_admin import Project, SupabaseAdminError
from leaseline.supabase_source import SourceError, fetch_listings
from leaseline.webhook import WebhookSetupError
from leaseline.webhook import setup as setup_webhook

app = typer.Typer(
    help="Sync LeaseLine tenants (agent config + listings) to ElevenLabs and build the site.",
    no_args_is_help=True,
)


def _version_callback(value: bool) -> None:
    if value:
        typer.echo(f"leaseline {__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: bool = typer.Option(
        False, "--version", callback=_version_callback, is_eager=True, help="Show version and exit."
    ),
) -> None:
    """LeaseLine CLI."""


TenantOption = typer.Option(..., "--tenant", "-t", help="Tenant slug (folder under tenants/).")
RootOption = typer.Option(Path("tenants"), "--root", help="Directory containing tenant folders.")


AgentDirOption = typer.Option(AGENT_DIR, "--agent-dir", help="Shared prompt and config.")
SourceOption = typer.Option(
    "supabase",
    "--source",
    help="Where listings come from: 'supabase' (published listings; the source of truth) or "
    "'files' (tenants/<slug>/listings/*.md, for tests and offline work).",
)


def _load_or_exit(tenant: str, root: Path, source: str = "files") -> ValidationReport:
    """Validate a tenant, printing problems. Exits non-zero if it has errors."""
    if source == "supabase":
        try:
            listings, listing_errors = fetch_listings(tenant)
        except SourceError as e:
            typer.secho(f"✗ {e}", fg=typer.colors.RED, bold=True, err=True)
            raise typer.Exit(code=1) from e
        report = validate_tenant(root / tenant, listings, listing_errors)
    elif source == "files":
        report = validate_tenant(root / tenant)
    else:
        typer.secho(f"✗ unknown --source {source!r}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=2)
    for warning in report.warnings:
        typer.secho(f"warning  {warning}", fg=typer.colors.YELLOW)
    for error in report.errors:
        typer.secho(f"error    {error}", fg=typer.colors.RED, err=True)
    if not report.ok:
        typer.secho(f"✗ {len(report.errors)} error(s)", fg=typer.colors.RED, bold=True, err=True)
        raise typer.Exit(code=1)
    return report


@app.command()
def validate(
    tenant: str = TenantOption, root: Path = RootOption, source: str = SourceOption
) -> None:
    """Check a tenant's config and listings. Exits non-zero on errors; unconfirmed facts warn."""
    report = _load_or_exit(tenant, root, source)
    typer.secho(
        f"✓ {tenant}: {len(report.listings)} listing(s) valid, {len(report.warnings)} warning(s)",
        fg=typer.colors.GREEN,
        bold=True,
    )


@app.command()
def render(
    tenant: str = TenantOption,
    root: Path = RootOption,
    agent_dir: Path = AgentDirOption,
    out: Path = typer.Option(Path("build"), "--out", help="Output directory."),
    source: str = SourceOption,
) -> None:
    """Render the prompt, first message, KB docs and tools to build/<tenant>/ for review."""
    report = _load_or_exit(tenant, root, source)
    assert report.tenant is not None
    rendered = render_agent(report.tenant, report.listings, agent_dir)
    for path in write_build(rendered, out / tenant):
        typer.echo(f"wrote    {path}")
    typer.secho(
        f"✓ {tenant}: prompt {len(rendered.prompt):,} chars, {len(rendered.kb_docs)} KB doc(s)",
        fg=typer.colors.GREEN,
        bold=True,
    )


def _client():  # pragma: no cover - thin wrapper around the SDK
    from elevenlabs import ElevenLabs

    load_dotenv()
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        typer.secho(
            "ELEVENLABS_API_KEY is not set (add it to .env; see .env.example)",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=2)
    return ElevenLabs(api_key=api_key)


@app.command()
def deploy(
    tenant: str = TenantOption,
    root: Path = RootOption,
    agent_dir: Path = AgentDirOption,
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Show the plan without changing anything."
    ),
    allow_mass_delete: bool = typer.Option(
        False, "--allow-mass-delete", help="Allow removing more than half of the listings."
    ),
    source: str = SourceOption,
) -> None:
    """Sync a tenant's agent and knowledge base to ElevenLabs (config from the repo, listings
    from Supabase)."""
    report = _load_or_exit(tenant, root, source)
    assert report.tenant is not None
    rendered = render_agent(report.tenant, report.listings, agent_dir)
    client = _client()

    plan = make_plan(client, report.tenant, rendered)
    for line in plan.summary():
        typer.echo(f"  {line}")
    try:
        check_plan(plan, allow_mass_delete=allow_mass_delete)
    except DeployError as e:
        typer.secho(f"✗ {e}", fg=typer.colors.RED, bold=True, err=True)
        raise typer.Exit(code=1) from e
    if dry_run or not plan.has_changes:
        typer.secho("✓ dry run, nothing changed" if dry_run else "✓ up to date", bold=True)
        return

    agent_id = apply_plan(client, plan, rendered)
    if record_agent_id(root / tenant / "tenant.yaml", agent_id):
        typer.secho(f"  wrote agent_id to {root / tenant / 'tenant.yaml'}; commit it", bold=True)
    typer.secho(f"✓ deployed {tenant} → agent {agent_id}", fg=typer.colors.GREEN, bold=True)


@app.command("export-site")
def export_site_command(
    tenant: str = TenantOption,
    root: Path = RootOption,
    out: Path = typer.Option(
        Path("apps/site/src/data/site.json"), "--out", help="Where the Next.js site reads its data."
    ),
) -> None:
    """Export a tenant's branding and assistant settings as JSON for the Next.js site. The site
    reads listings from Supabase itself."""
    report = validate_tenant(root / tenant, listings=[])
    if report.tenant is None:
        for error in report.errors:
            typer.secho(f"error    {error}", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)
    try:
        path = export_site(report.tenant, out)
    except SiteError as e:
        typer.secho(f"✗ {e}", fg=typer.colors.RED, bold=True, err=True)
        raise typer.Exit(code=1) from e
    typer.secho(f"✓ wrote {path} for {tenant}", fg=typer.colors.GREEN, bold=True)


SUPABASE_PROJECT_REF = "lyplhlbjuhsigkurckqx"


@app.command("setup-webhook")
def setup_webhook_command(
    project_ref: str = typer.Option(
        SUPABASE_PROJECT_REF, "--project-ref", help="Supabase project."
    ),
    rotate: bool = typer.Option(False, "--rotate", help="Replace the webhook and its secret."),
) -> None:
    """Point ElevenLabs' post-call webhook at Supabase's ingest-lead function.

    Needs ELEVENLABS_API_KEY and SUPABASE_ACCESS_TOKEN (a scoped personal access token) in .env.
    The webhook secret goes straight from ElevenLabs to Supabase and is never printed.
    """
    client = _client()
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        typer.secho(
            "SUPABASE_ACCESS_TOKEN is not set (add it to .env)", fg=typer.colors.RED, err=True
        )
        raise typer.Exit(code=2)
    try:
        result = setup_webhook(client, project_ref, token, rotate=rotate)
    except WebhookSetupError as e:
        typer.secho(f"✗ {e}", fg=typer.colors.RED, bold=True, err=True)
        raise typer.Exit(code=1) from e
    verb = "created" if result.created else "kept"
    typer.echo(f"  {verb} webhook {result.webhook_id}")
    typer.echo(f"  self-test: {result.self_test}")
    typer.secho("✓ post-call webhook → ingest-lead", fg=typer.colors.GREEN, bold=True)


def _supabase_token() -> str:
    load_dotenv()
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        typer.secho(
            "SUPABASE_ACCESS_TOKEN is not set (add a project-scoped token to .env)",
            fg=typer.colors.RED,
            err=True,
        )
        raise typer.Exit(code=2)
    return token


@app.command("configure-auth")
def configure_auth_command(
    project_ref: str = typer.Option(SUPABASE_PROJECT_REF, "--project-ref"),
) -> None:
    """Make dashboard login invite-only and allow its callback URLs."""
    try:
        settings = Project(project_ref, _supabase_token()).configure_auth()
    except SupabaseAdminError as e:
        typer.secho(f"✗ {e}", fg=typer.colors.RED, bold=True, err=True)
        raise typer.Exit(code=1) from e
    typer.echo(f"  sign-up disabled, site URL {settings['site_url']}")
    typer.echo(f"  allowed redirects: {settings['uri_allow_list']}")
    typer.secho("✓ auth configured", fg=typer.colors.GREEN, bold=True)


@app.command("add-member")
def add_member_command(
    email: str = typer.Argument(..., help="Their work email (they sign in with a link sent here)."),
    tenant: str = typer.Option("demo", "--tenant", "-t"),
    role: str = typer.Option("editor", "--role", help="admin, editor, or viewer."),
    project_ref: str = typer.Option(SUPABASE_PROJECT_REF, "--project-ref"),
) -> None:
    """Give someone access to a tenant's dashboard (creates their login if needed)."""
    try:
        user_id, created = Project(project_ref, _supabase_token()).add_member(email, tenant, role)
    except SupabaseAdminError as e:
        typer.secho(f"✗ {e}", fg=typer.colors.RED, bold=True, err=True)
        raise typer.Exit(code=1) from e
    typer.echo(f"  {'created' if created else 'found'} user {user_id}")
    typer.secho(f"✓ {email} is now {role} of {tenant}", fg=typer.colors.GREEN, bold=True)
