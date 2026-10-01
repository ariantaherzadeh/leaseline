"""Read a tenant's published listings from Supabase (the source of truth since v2).

Only published listings are public, so this uses the project's publishable key: no secrets.
Rows are converted into the same `Listing` model the file-based pipeline used, so rendering,
knowledge-base sync and validation are unchanged. A NULL fact becomes TBD ("not confirmed").
"""

from datetime import date
from typing import Any

import httpx
from pydantic import ValidationError

from leaseline.models import TBD, Listing, Parking

SUPABASE_URL = "https://lyplhlbjuhsigkurckqx.supabase.co"
# Publishable (browser-safe) key: row-level security only exposes published listings.
SUPABASE_PUBLISHABLE_KEY = "sb_publishable_GoSBclQLRWtKdjTJNfIXsw_wXTx1Fgx"


class SourceError(Exception):
    """Listings couldn't be read from Supabase."""


def _fact(value: Any) -> Any:
    return TBD if value is None else value


def _sqft(value: str | None) -> int | str:
    if value is None:
        return TBD
    return int(value) if value.isdigit() else value


def row_to_listing(row: dict[str, Any]) -> Listing:
    if row["available_now"]:
        available: Any = "immediately"
    elif row["available_on"]:
        available = date.fromisoformat(row["available_on"])
    else:
        available = TBD
    parking: Any = (
        TBD
        if row["parking_spots"] is None
        else Parking(spots=row["parking_spots"], type=row["parking_type"])
    )
    return Listing(
        id=row["slug"],
        title=row["title"],
        address={
            "street": row["street"],
            "unit": row["unit"],
            "city": row["city"],
            "province": row["province"],
            "postal_code": row["postal_code"],
        },
        neighbourhood=row["neighbourhood"],
        property_type=row["property_type"],
        rent_monthly=row["rent_monthly"],
        beds=row["beds"],
        baths=float(row["baths"]),
        sqft=_sqft(row["sqft"]),
        available=available,
        pets=_fact(row["pets"]),
        utilities_included=row["utilities_included"],
        tenant_pays=row["tenant_pays"],
        laundry=_fact(row["laundry"]),
        parking=parking,
        cooling=_fact(row["cooling"]),
        heating=_fact(row["heating"]),
        outdoor=row["outdoor"],
        storage=row["storage"],
        amenities=row["amenities"],
        transit=row["transit"],
        highlights=row["highlights"],
        source={"mls_number": row["mls_number"]} if row["mls_number"] else None,
        body=row["description"],
    )


def fetch_rows(tenant_slug: str, client: httpx.Client | None = None) -> list[dict[str, Any]]:
    params = {
        "select": "*,tenants!inner(slug)",
        "tenants.slug": f"eq.{tenant_slug}",
        "status": "eq.published",
        "order": "slug",
    }
    headers = {"apikey": SUPABASE_PUBLISHABLE_KEY}
    http = client or httpx.Client(timeout=30)
    try:
        res = http.get(f"{SUPABASE_URL}/rest/v1/listings", params=params, headers=headers)
    except httpx.HTTPError as e:
        raise SourceError(f"could not reach Supabase: {e}") from e
    finally:
        if client is None:
            http.close()
    if res.status_code != 200:
        raise SourceError(f"Supabase returned {res.status_code}: {res.text[:200]}")
    return res.json()


def fetch_listings(
    tenant_slug: str, client: httpx.Client | None = None
) -> tuple[list[Listing], list[str]]:
    """Published listings for a tenant, plus an error per row that failed validation."""
    listings, errors = [], []
    for row in fetch_rows(tenant_slug, client):
        try:
            listings.append(row_to_listing(row))
        except ValidationError as e:
            errors.append(f"listing {row.get('slug')!r} in Supabase: {e.errors()[0]['msg']}")
    return listings, errors
