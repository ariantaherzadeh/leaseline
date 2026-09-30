"""Command-line interface: `leaseline <command> --tenant <slug>`."""

from pathlib import Path

import typer

from leaseline import __version__
from leaseline.loader import validate_tenant

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


@app.command()
def validate(tenant: str = TenantOption, root: Path = RootOption) -> None:
    """Check a tenant's config and listings. Exits non-zero on errors; TBD fields are warnings."""
    report = validate_tenant(root / tenant)
    for warning in report.warnings:
        typer.secho(f"warning  {warning}", fg=typer.colors.YELLOW)
    for error in report.errors:
        typer.secho(f"error    {error}", fg=typer.colors.RED, err=True)
    if not report.ok:
        typer.secho(f"✗ {len(report.errors)} error(s)", fg=typer.colors.RED, bold=True, err=True)
        raise typer.Exit(code=1)
    typer.secho(
        f"✓ {tenant}: {len(report.listings)} listing(s) valid, {len(report.warnings)} warning(s)",
        fg=typer.colors.GREEN,
        bold=True,
    )
