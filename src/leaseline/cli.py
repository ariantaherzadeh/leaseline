"""Command-line interface: `leaseline <command> --tenant <slug>`."""

from pathlib import Path

import typer

from leaseline import __version__
from leaseline.loader import ValidationReport, validate_tenant
from leaseline.render import AGENT_DIR, render_agent, write_build

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
