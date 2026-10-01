"""Export a tenant as JSON for the Next.js site (apps/site). Python stays the single source of truth
for listing data: it validates, then hands the site display-ready values. No secrets: the page
only carries the public agent id, and the agent itself is locked to the tenant's domains."""

import json
from pathlib import Path
from typing import Any

from leaseline.models import TBD, Listing, Parking, Tenant

TO_BE_CONFIRMED = "To be confirmed"


class SiteError(Exception):
    """A site that can't be exported."""


def _fact(value: Any, suffix: str = "") -> str:
    if value == TBD:
        return TO_BE_CONFIRMED
    if value == "immediately":
        return "Now"
    if hasattr(value, "strftime"):
        return value.strftime("%B %-d, %Y")
    return f"{value}{suffix}"


def _parking(value: Parking | str) -> str:
    if value == TBD:
        return TO_BE_CONFIRMED
    assert isinstance(value, Parking)
    if value.spots == 0:
        return "None"
    return f"{value.spots} {value.type or 'spot'}"


def _stats(listing: Listing) -> list[dict[str, str]]:
    """The 'bds | ba | sqft' line. Unconfirmed size is left out rather than shown as TBD."""
    stats = [
        {"value": str(listing.beds), "label": "bd" if listing.beds == 1 else "bds"},
        {"value": f"{listing.baths:g}", "label": "ba"},
    ]
    if listing.sqft != TBD:
        stats.append({"value": str(listing.sqft), "label": "sqft"})
    return stats


def _tags(listing: Listing) -> list[str]:
    """Short feature tags for the card, only from confirmed facts."""
    tags = []
    if listing.available == "immediately":
        tags.append("Available now")
    if listing.pets not in (TBD, "No pets") and listing.pets.lower().startswith("pet friendly"):
        tags.append("Pet friendly")
    if isinstance(listing.parking, Parking) and listing.parking.spots:
        tags.append(f"{listing.parking.spots} parking")
    if listing.utilities_included:
        tags.append(f"{' & '.join(listing.utilities_included).capitalize()} included")
    if listing.laundry != TBD and "in" in listing.laundry.lower():
        tags.append("In-unit laundry")
    if listing.cooling not in (TBD, "None"):
        tags.append("A/C")
    return tags


def listing_card(listing: Listing, persona_name: str) -> dict[str, Any]:
    included = ", ".join(listing.utilities_included).capitalize() or f"Ask {persona_name}"
    return {
        "id": listing.id,
        "title": listing.title,
        "neighbourhood": listing.neighbourhood,
        "rent": f"${listing.rent_monthly:,}",
        "layout": f"{listing.beds} bed, {listing.baths:g} bath",
        "stats": _stats(listing),
        "tags": _tags(listing),
        "highlights": listing.highlights[:3],
        "facts": [
            {"label": "Size", "value": _fact(listing.sqft, " sq ft")},
            {"label": "Available", "value": _fact(listing.available)},
            {"label": "Pets", "value": _fact(listing.pets)},
            {"label": "Parking", "value": _parking(listing.parking)},
            {"label": "Included", "value": included},
            {"label": "Cooling", "value": _fact(listing.cooling)},
        ],
    }


def site_data(tenant: Tenant, listings: list[Listing]) -> dict[str, Any]:
    if not tenant.agent_id:
        raise SiteError(f"{tenant.slug} has no agent_id yet; run `leaseline deploy` first")
    return {
        "siteUrl": f"https://{tenant.domains[0]}",
        "agentId": tenant.agent_id,
        "persona": {"name": tenant.persona.name},
        "team": {"name": tenant.team.name, "city": tenant.team.city},
        "brand": {"accent": tenant.brand.accent, "coBrand": tenant.brand.co_brand},
        "followUp": tenant.follow_up,
        "listings": [listing_card(listing, tenant.persona.name) for listing in listings],
    }


def export_site(tenant: Tenant, listings: list[Listing], out_file: Path) -> Path:
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(site_data(tenant, listings), indent=2) + "\n", encoding="utf-8")
    return out_file
