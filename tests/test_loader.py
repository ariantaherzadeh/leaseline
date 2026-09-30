from pathlib import Path

import pytest
from typer.testing import CliRunner

from leaseline.cli import app
from leaseline.loader import LoadError, split_front_matter, validate_tenant

REPO_ROOT = Path(__file__).resolve().parent.parent
TENANTS = REPO_ROOT / "tenants"
TEMPLATE = TENANTS / "_template"

runner = CliRunner()


def make_tenant(tmp_path: Path, slug: str = "acme") -> Path:
    """A valid tenant folder built from the repo's own templates."""
    tenant_dir = tmp_path / slug
    (tenant_dir / "listings").mkdir(parents=True)
    tenant_yaml = (TEMPLATE / "tenant.yaml").read_text().replace("slug: your-slug", f"slug: {slug}")
    (tenant_dir / "tenant.yaml").write_text(tenant_yaml)
    listing = (TEMPLATE / "listings" / "_listing-template.md").read_text()
    (tenant_dir / "listings" / "street-number-unit.md").write_text(listing)
    return tenant_dir


def write_listing(tenant_dir: Path, name: str, text: str) -> None:
    (tenant_dir / "listings" / f"{name}.md").write_text(text)


# --- the real data ---------------------------------------------------------------------------


def test_demo_tenant_is_valid() -> None:
    report = validate_tenant(TENANTS / "demo")
    assert report.ok, report.errors
    assert {listing.id for listing in report.listings} == {
        "gladstone-920-1",
        "icon-805-carling-1105",
    }


def test_template_is_valid(tmp_path: Path) -> None:
    report = validate_tenant(make_tenant(tmp_path))
    assert report.ok, report.errors
    assert report.warnings, "template placeholders should surface as TBD warnings"


# --- front matter ----------------------------------------------------------------------------


def test_split_front_matter() -> None:
    data, body = split_front_matter("---\nid: x\n---\n\n## Body\ntext\n")
    assert data == {"id": "x"}
    assert body == "## Body\ntext"


@pytest.mark.parametrize(
    ("text", "message"),
    [
        ("id: x\n", "missing YAML front matter"),
        ("---\nid: x\n", "not closed"),
        ("---\n- a\n- b\n---\nbody", "must be a YAML mapping"),
    ],
)
def test_split_front_matter_errors(text: str, message: str) -> None:
    with pytest.raises(LoadError, match=message):
        split_front_matter(text)


# --- validation rules ------------------------------------------------------------------------


def test_id_must_match_filename(tmp_path: Path) -> None:
    tenant_dir = make_tenant(tmp_path)
    src = tenant_dir / "listings" / "street-number-unit.md"
    src.rename(tenant_dir / "listings" / "renamed.md")
    report = validate_tenant(tenant_dir)
    assert any("must match filename" in e for e in report.errors)


def test_slug_must_match_folder(tmp_path: Path) -> None:
    tenant_dir = make_tenant(tmp_path)
    tenant_dir.rename(tmp_path / "other")
    report = validate_tenant(tmp_path / "other")
    assert any("must match folder" in e for e in report.errors)


def test_unknown_fields_are_rejected(tmp_path: Path) -> None:
    tenant_dir = make_tenant(tmp_path)
    path = tenant_dir / "listings" / "street-number-unit.md"
    path.write_text(path.read_text().replace("beds: 1", "beds: 1\nbedrooms: 1"))
    report = validate_tenant(tenant_dir)
    assert any("bedrooms" in e for e in report.errors)


def test_unquoted_province_is_caught(tmp_path: Path) -> None:
    """YAML parses a bare `ON` as a boolean; make sure that fails loudly."""
    tenant_dir = make_tenant(tmp_path)
    path = tenant_dir / "listings" / "street-number-unit.md"
    text = path.read_text()
    path.write_text(text.replace('province: "ON"', "province: ON"))
    report = validate_tenant(tenant_dir)
    assert any("address.province" in e for e in report.errors)


@pytest.mark.parametrize(
    ("field", "value"),
    [("rent_monthly", "0"), ("sqft", "big"), ("available", "soon"), ("id", "Bad_ID")],
)
def test_bad_values_are_rejected(tmp_path: Path, field: str, value: str) -> None:
    tenant_dir = make_tenant(tmp_path)
    path = tenant_dir / "listings" / "street-number-unit.md"
    lines = [
        f"{field}: {value}" if line.startswith(f"{field}:") else line
        for line in path.read_text().splitlines()
    ]
    path.write_text("\n".join(lines))
    assert not validate_tenant(tenant_dir).ok


def test_templates_are_skipped_and_empty_tenant_errors(tmp_path: Path) -> None:
    tenant_dir = make_tenant(tmp_path)
    (tenant_dir / "listings" / "street-number-unit.md").rename(
        tenant_dir / "listings" / "_draft.md"
    )
    report = validate_tenant(tenant_dir)
    assert any("no listings found" in e for e in report.errors)


def test_bad_domain_is_rejected(tmp_path: Path) -> None:
    tenant_dir = make_tenant(tmp_path)
    path = tenant_dir / "tenant.yaml"
    path.write_text(path.read_text().replace("- localhost", "- https://localhost"))
    report = validate_tenant(tenant_dir)
    assert any("bare hostname" in e for e in report.errors)


# --- CLI -------------------------------------------------------------------------------------


def test_cli_validate_ok() -> None:
    result = runner.invoke(app, ["validate", "--tenant", "demo", "--root", str(TENANTS)])
    assert result.exit_code == 0, result.output
    assert "2 listing(s) valid" in result.output


def test_cli_validate_fails(tmp_path: Path) -> None:
    result = runner.invoke(app, ["validate", "--tenant", "missing", "--root", str(tmp_path)])
    assert result.exit_code == 1
