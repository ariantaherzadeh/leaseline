import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from leaseline.cli import app
from leaseline.loader import validate_tenant
from leaseline.site import SiteError, export_site, site_data

REPO_ROOT = Path(__file__).resolve().parent.parent
TENANTS = REPO_ROOT / "tenants"

runner = CliRunner()


@pytest.fixture(scope="module")
def demo():
    report = validate_tenant(TENANTS / "demo")
    assert report.ok
    return report.tenant, report.listings


def test_site_data_has_what_the_page_needs(demo) -> None:
    tenant, listings = demo
    data = site_data(tenant, listings)
    assert data["agentId"] == tenant.agent_id
    assert data["siteUrl"] == "https://tryleaseline.com"
    assert data["persona"] == {"name": "Nora"}
    assert [listing["id"] for listing in data["listings"]] == [
        "gladstone-920-1",
        "icon-805-carling-1105",
    ]


def test_cards_are_display_ready(demo) -> None:
    tenant, listings = demo
    gladstone = site_data(tenant, listings)["listings"][0]
    assert gladstone["rent"] == "$2,695"
    assert gladstone["layout"] == "2 bed, 1 bath"
    facts = {f["label"]: f["value"] for f in gladstone["facts"]}
    assert facts == {
        "Size": "700 sq ft",
        "Available": "Now",
        "Pets": "Pet friendly",
        "Parking": "2 driveway",
        "Included": "Heat, water",
        "Cooling": "None",
    }


def test_unconfirmed_facts_are_labelled(demo) -> None:
    tenant, listings = demo
    icon = site_data(tenant, listings)["listings"][1]
    assert {"label": "Available", "value": "To be confirmed"} in icon["facts"]
    assert "TBD" not in json.dumps(icon)


def test_export_requires_a_deployed_agent(demo) -> None:
    tenant, listings = demo
    with pytest.raises(SiteError, match="run `leaseline deploy` first"):
        site_data(tenant.model_copy(update={"agent_id": None}), listings)


def test_export_writes_json(demo, tmp_path: Path) -> None:
    tenant, listings = demo
    out = export_site(tenant, listings, tmp_path / "data" / "site.json")
    assert json.loads(out.read_text())["agentId"] == tenant.agent_id


def test_cli_export_site(tmp_path: Path) -> None:
    out = tmp_path / "site.json"
    result = runner.invoke(
        app, ["export-site", "-t", "demo", "--root", str(TENANTS), "--out", str(out)]
    )
    assert result.exit_code == 0, result.output
    assert out.is_file()


def test_card_stats_and_tags(demo) -> None:
    tenant, listings = demo
    gladstone, icon = site_data(tenant, listings)["listings"]
    assert gladstone["stats"] == [
        {"value": "2", "label": "bds"},
        {"value": "1", "label": "ba"},
        {"value": "700", "label": "sqft"},
    ]
    assert gladstone["tags"] == [
        "Available now",
        "Pet friendly",
        "2 parking",
        "Heat & water included",
        "In-unit laundry",
    ]
    # Unconfirmed availability and restricted pets never become tags.
    assert "Available now" not in icon["tags"]
    assert "Pet friendly" not in icon["tags"]
    assert "A/C" in icon["tags"]
