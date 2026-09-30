"""Command-line interface: `leaseline <command> --tenant <slug>`."""

import typer

from leaseline import __version__

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
