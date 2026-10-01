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


def _load_or_exit(tenant: str, root: Path) -> ValidationReport:
    """Validate a tenant, printing problems. Exits non-zero if it has errors."""
    report = validate_tenant(root / tenant)
    for warning in report.warnings:
        typer.secho(f"warning  {warning}", fg=typer.colors.YELLOW)
    for error in report.errors:
        typer.secho(f"error    {error}", fg=typer.colors.RED, err=True)
    if not report.ok:
        typer.secho(f"✗ {len(report.errors)} error(s)", fg=typer.colors.RED, bold=True, err=True)
        raise typer.Exit(code=1)
    return report


@app.command()
def validate(tenant: str = TenantOption, root: Path = RootOption) -> None:
    """Check a tenant's config and listings. Exits non-zero on errors; TBD fields are warnings."""
    report = _load_or_exit(tenant, root)
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
) -> None:
    """Render the prompt, first message, KB docs and tools to build/<tenant>/ for review."""
    report = _load_or_exit(tenant, root)
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
) -> None:
    """Sync a tenant's agent and knowledge base to ElevenLabs so they match the repo."""
    report = _load_or_exit(tenant, root)
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
    """Export a tenant's listings and branding as JSON for the Next.js site (apps/site)."""
    report = _load_or_exit(tenant, root)
    assert report.tenant is not None
    try:
        path = export_site(report.tenant, report.listings, out)
    except SiteError as e:
        typer.secho(f"✗ {e}", fg=typer.colors.RED, bold=True, err=True)
        raise typer.Exit(code=1) from e
    typer.secho(f"✓ wrote {path} for {tenant}", fg=typer.colors.GREEN, bold=True)
