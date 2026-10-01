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
def tenant():
    report = validate_tenant(TENANTS / "demo", listings=[])
    assert report.tenant is not None
    return report.tenant


def test_site_data_is_branding_only(tenant) -> None:
    data = site_data(tenant)
    assert data["agentId"] == tenant.agent_id
    assert data["tenantSlug"] == "demo"
    assert data["persona"] == {"name": "Nora"}
    assert data["siteUrl"] == "https://tryleaseline.com"
    assert "listings" not in data  # the site reads listings from Supabase


def test_export_requires_a_deployed_agent(tenant) -> None:
    with pytest.raises(SiteError, match="run `leaseline deploy` first"):
        site_data(tenant.model_copy(update={"agent_id": None}))


def test_export_writes_json(tenant, tmp_path: Path) -> None:
    out = export_site(tenant, tmp_path / "data" / "site.json")
    assert json.loads(out.read_text())["agentId"] == tenant.agent_id


def test_cli_export_site(tmp_path: Path) -> None:
    out = tmp_path / "site.json"
    result = runner.invoke(
        app, ["export-site", "-t", "demo", "--root", str(TENANTS), "--out", str(out)]
    )
    assert result.exit_code == 0, result.output
    assert out.is_file()
