from datetime import date

import httpx

from leaseline.models import TBD, Parking
from leaseline.supabase_source import fetch_listings, row_to_listing

ROW = {
    "slug": "icon-805-carling-1105",
    "title": "The Icon, 805 Carling Ave, Unit 1105",
    "street": "805 Carling Ave",
    "unit": "1105",
    "city": "Ottawa",
    "province": "ON",
    "postal_code": "K1S 5W9",
    "neighbourhood": "Dow's Lake",
    "property_type": "Condo apartment",
    "rent_monthly": 2400,
    "beds": 1,
    "baths": 1.0,
    "sqft": "600\u2013699",
    "available_now": False,
    "available_on": None,
    "pets": None,
    "laundry": "In-suite",
    "cooling": "Central air conditioning",
    "heating": None,
    "parking_spots": 1,
    "parking_type": "underground",
    "utilities_included": ["heat", "water"],
    "tenant_pays": ["hydro"],
    "amenities": ["Indoor pool"],
    "highlights": ["Lake view"],
    "outdoor": "Balcony",
    "storage": None,
    "transit": None,
    "description": "A one-bedroom with a view.",
    "mls_number": "X13839592",
}


def test_null_facts_become_tbd() -> None:
    listing = row_to_listing(ROW)
    assert listing.available == TBD
    assert listing.pets == TBD
    assert listing.heating == TBD
    assert set(listing.tbd_fields()) == {"available", "pets", "heating"}


def test_row_values_map_to_the_listing_model() -> None:
    listing = row_to_listing(ROW)
    assert listing.id == "icon-805-carling-1105"
    assert listing.sqft == "600\u2013699"
    assert listing.parking == Parking(spots=1, type="underground")
    assert listing.address.unit == "1105"
    assert listing.body == "A one-bedroom with a view."
    assert listing.source is not None and listing.source.mls_number == "X13839592"


def test_availability_variants() -> None:
    assert row_to_listing({**ROW, "available_now": True}).available == "immediately"
    assert row_to_listing({**ROW, "available_on": "2026-11-01"}).available == date(2026, 11, 1)
    assert row_to_listing({**ROW, "sqft": "700"}).sqft == 700
    assert row_to_listing({**ROW, "parking_spots": None}).parking == TBD


def test_fetch_uses_publishable_key_and_reports_bad_rows() -> None:
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["apikey"] = request.headers["apikey"]
        seen["query"] = str(request.url.query)
        return httpx.Response(200, json=[ROW, {**ROW, "slug": "Bad Slug"}])

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        listings, errors = fetch_listings("demo", client)
    assert seen["apikey"].startswith("sb_publishable_")
    assert "status=eq.published" in seen["query"] and "tenants.slug=eq.demo" in seen["query"]
    assert [listing.id for listing in listings] == ["icon-805-carling-1105"]
    assert len(errors) == 1 and "Bad Slug" in errors[0]
