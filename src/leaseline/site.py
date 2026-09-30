"""Export a tenant as JSON for the Next.js site (web/). Python stays the single source of truth
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


def listing_card(listing: Listing, persona_name: str) -> dict[str, Any]:
    included = ", ".join(listing.utilities_included).capitalize() or f"Ask {persona_name}"
    return {
        "id": listing.id,
        "title": listing.title,
        "neighbourhood": listing.neighbourhood,
        "rent": f"${listing.rent_monthly:,}",
        "layout": f"{listing.beds} bed, {listing.baths:g} bath",
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
