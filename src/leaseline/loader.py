"""Load and validate a tenant folder: ``tenants/<slug>/tenant.yaml`` + ``listings/*.md``."""

from dataclasses import dataclass, field
from pathlib import Path

import yaml
from pydantic import ValidationError

from leaseline.models import Listing, Tenant

FRONT_MATTER_DELIMITER = "---"


class LoadError(Exception):
    """A tenant folder that can't be loaded."""


@dataclass
class ValidationReport:
    tenant: Tenant | None = None
    listings: list[Listing] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors


def split_front_matter(text: str) -> tuple[dict, str]:
    """Split a Markdown document into (front matter dict, body)."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != FRONT_MATTER_DELIMITER:
        raise LoadError("missing YAML front matter (file must start with '---')")
    try:
        end = next(
            i for i, line in enumerate(lines[1:], 1) if line.strip() == FRONT_MATTER_DELIMITER
        )
    except StopIteration:
        raise LoadError("front matter is not closed with '---'") from None
    data = yaml.safe_load("\n".join(lines[1:end])) or {}
    if not isinstance(data, dict):
        raise LoadError("front matter must be a YAML mapping")
    return data, "\n".join(lines[end + 1 :]).strip()


def load_listing(path: Path) -> Listing:
    data, body = split_front_matter(path.read_text(encoding="utf-8"))
    return Listing(**data, body=body)


def listing_paths(tenant_dir: Path) -> list[Path]:
    """Listing files, skipping templates (files starting with '_')."""
    return sorted(p for p in (tenant_dir / "listings").glob("*.md") if not p.name.startswith("_"))


def _format_validation_error(err: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(p) for p in e['loc']) or '(root)'}: {e['msg']}" for e in err.errors()
    )


def validate_tenant(
    tenant_dir: Path, listings: list[Listing] | None = None, listing_errors: list[str] | None = None
) -> ValidationReport:
    """Load a tenant folder, collecting every problem instead of stopping at the first.

    Listings come from `listings` when given (e.g. read from Supabase), otherwise from the
    folder's `listings/*.md` files (used by tests and offline work)."""
    report = ValidationReport()

    tenant_file = tenant_dir / "tenant.yaml"
    if not tenant_file.is_file():
        report.errors.append(f"{tenant_file}: not found")
        return report
    try:
        report.tenant = Tenant(**(yaml.safe_load(tenant_file.read_text(encoding="utf-8")) or {}))
    except ValidationError as e:
        report.errors.append(f"{tenant_file}: {_format_validation_error(e)}")
    else:
        if report.tenant.slug != tenant_dir.name:
            report.errors.append(
                f"{tenant_file}: slug {report.tenant.slug!r} must match folder {tenant_dir.name!r}"
            )

    if listings is not None:
        report.errors.extend(listing_errors or [])
        _check_listings(report, [(None, listing) for listing in listings])
        return report

    paths = listing_paths(tenant_dir)
    if not paths:
        report.errors.append(f"{tenant_dir / 'listings'}: no listings found")

    loaded: list[tuple[Path | None, Listing]] = []
    for path in paths:
        try:
            listing = load_listing(path)
        except LoadError as e:
            report.errors.append(f"{path}: {e}")
            continue
        except ValidationError as e:
            report.errors.append(f"{path}: {_format_validation_error(e)}")
            continue
        if listing.id != path.stem:
            report.errors.append(f"{path}: id {listing.id!r} must match filename {path.stem!r}")
        loaded.append((path, listing))
    _check_listings(report, loaded)
    return report


def _check_listings(report: ValidationReport, loaded: list[tuple[Path | None, Listing]]) -> None:
    seen: dict[str, str] = {}
    for path, listing in loaded:
        where = str(path) if path else f"listing {listing.id!r}"
        if listing.id in seen:
            report.errors.append(
                f"{where}: duplicate id {listing.id!r} (also in {seen[listing.id]})"
            )
        seen[listing.id] = where
        for name in listing.tbd_fields():
            report.warnings.append(f"{where}: {name} is not confirmed (the assistant will say so)")
        report.listings.append(listing)
