from pathlib import Path

import pytest
from typer.testing import CliRunner

from leaseline.cli import app
from leaseline.loader import validate_tenant
from leaseline.render import NOT_CONFIRMED, RenderedAgent, kb_doc_name, render_agent, write_build

REPO_ROOT = Path(__file__).resolve().parent.parent
AGENT_DIR = REPO_ROOT / "agent"
TENANTS = REPO_ROOT / "tests" / "fixtures" / "tenants"

runner = CliRunner()


@pytest.fixture(scope="module")
def rendered() -> RenderedAgent:
    report = validate_tenant(TENANTS / "demo")
    assert report.tenant is not None
    return render_agent(report.tenant, report.listings, AGENT_DIR)


def kb(rendered: RenderedAgent, listing_id: str) -> str:
    return next(d.text for d in rendered.kb_docs if d.listing_id == listing_id)


def test_prompt_is_personalised_and_listing_free(rendered: RenderedAgent) -> None:
    assert "You are Nora" in rendered.prompt
    assert "the leasing team" in rendered.prompt
    # Homes come only from the knowledge base, so listing changes never touch the prompt.
    assert "gladstone" not in rendered.prompt.lower()
    assert "$2,695" not in rendered.prompt


def test_prompt_has_the_non_negotiables(rendered: RenderedAgent) -> None:
    prompt = " ".join(rendered.prompt.split())  # ignore line wrapping
    for must_have in ("Fair housing", "Never guess", "AI", "show_listing", "end_call"):
        assert must_have in prompt


def test_prompt_template_names_no_specific_listing() -> None:
    """The shared prompt is used by every tenant, so listings only enter through data."""
    template = (AGENT_DIR / "prompt.md.j2").read_text()
    assert "Gladstone" not in template
    assert "Icon" not in template


def test_first_message_discloses_ai(rendered: RenderedAgent) -> None:
    assert rendered.first_message.startswith("Hi, I'm Nora, an AI leasing assistant")


def test_kb_facts(rendered: RenderedAgent) -> None:
    gladstone = kb(rendered, "gladstone-920-1")
    assert "- Rent: $2,695 per month" in gladstone
    assert "- Size: 700 square feet" in gladstone
    assert "- Available: Immediately" in gladstone
    assert "- Parking: 2 driveway spots" in gladstone
    assert "- Cooling: None" in gladstone


def test_tbd_is_rendered_as_not_confirmed(rendered: RenderedAgent) -> None:
    assert f"- Available: {NOT_CONFIRMED}" in kb(rendered, "icon-805-carling-1105")
    for doc in rendered.kb_docs:
        assert "TBD" not in doc.text


def test_kb_doc_names_change_only_when_content_changes() -> None:
    a = kb_doc_name("demo", "x", "same text")
    assert a == kb_doc_name("demo", "x", "same text")
    assert a != kb_doc_name("demo", "x", "different text")
    assert a.startswith("leaseline/demo/x@")


def test_client_tools_take_ids_from_the_knowledge_base(rendered: RenderedAgent) -> None:
    tools = {t["name"]: t for t in rendered.client_tools}
    assert set(tools) == {"show_listing", "show_showing_request"}
    listing_id = tools["show_listing"]["parameters"]["properties"]["listing_id"]
    assert "enum" not in listing_id
    assert "Listing ID" in listing_id["description"]
    assert "Listing ID: gladstone-920-1" in kb(rendered, "gladstone-920-1")


def test_write_build_removes_stale_kb_docs(rendered: RenderedAgent, tmp_path: Path) -> None:
    (tmp_path / "kb").mkdir()
    (tmp_path / "kb" / "deleted-listing.md").write_text("old")
    write_build(rendered, tmp_path)
    assert sorted(p.name for p in (tmp_path / "kb").iterdir()) == [
        "gladstone-920-1.md",
        "icon-805-carling-1105.md",
    ]
    assert (tmp_path / "prompt.md").read_text() == rendered.prompt


def test_cli_render(tmp_path: Path) -> None:
    result = runner.invoke(
        app,
        [
            "render",
            "-t",
            "demo",
            "--root",
            str(TENANTS),
            "--agent-dir",
            str(AGENT_DIR),
            "--out",
            str(tmp_path),
            "--source",
            "files",
        ],
    )
    assert result.exit_code == 0, result.output
    assert (tmp_path / "demo" / "prompt.md").is_file()


def test_client_tools_receive_the_conversation_id(rendered: RenderedAgent) -> None:
    """Filled by ElevenLabs (not the model) so the page can open this call's team view."""
    for tool in rendered.client_tools:
        param = tool["parameters"]["properties"]["conversation_id"]
        assert param == {"type": "string", "dynamic_variable": "system__conversation_id"}
        assert "conversation_id" not in tool["parameters"]["required"]
