import shutil
from pathlib import Path

import pytest

from fake_elevenlabs import FakeElevenLabs
from leaseline.deploy import DeployError, apply_plan, check_plan, make_plan, record_agent_id
from leaseline.loader import validate_tenant
from leaseline.render import RenderedAgent, render_agent

REPO_ROOT = Path(__file__).resolve().parent.parent
AGENT_DIR = REPO_ROOT / "agent"


@pytest.fixture
def tenant_dir(tmp_path: Path) -> Path:
    """A writable copy of the demo tenant, not yet deployed (agent_id reset)."""
    tenant_dir = Path(shutil.copytree(REPO_ROOT / "tenants" / "demo", tmp_path / "demo"))
    record_agent_id(tenant_dir / "tenant.yaml", "null")
    return tenant_dir


def render(tenant_dir: Path) -> tuple:
    report = validate_tenant(tenant_dir)
    assert report.ok, report.errors
    return report.tenant, render_agent(report.tenant, report.listings, AGENT_DIR)


def deploy(client: FakeElevenLabs, tenant_dir: Path, **check_kwargs) -> str:
    tenant, rendered = render(tenant_dir)
    plan = make_plan(client, tenant, rendered)
    check_plan(plan, **check_kwargs)
    if not plan.has_changes:
        return plan.agent_id
    return apply_plan(client, plan, rendered)


def listing_ids_on_agent(client: FakeElevenLabs, agent_id: str) -> set[str]:
    kb = client.agents[agent_id].conversation_config["agent"]["prompt"]["knowledge_base"]
    return {client.docs[k["id"]].name.split("/")[-1].split("@")[0] for k in kb}


def test_first_deploy_creates_docs_then_agent(tenant_dir: Path) -> None:
    client = FakeElevenLabs()
    agent_id = deploy(client, tenant_dir)
    assert [c.split(" ")[0] for c in client.calls] == ["kb.create", "kb.create", "agent.create"]
    assert listing_ids_on_agent(client, agent_id) == {"gladstone-920-1", "icon-805-carling-1105"}
    kb = client.agents[agent_id].conversation_config["agent"]["prompt"]["knowledge_base"]
    assert all(k["usage_mode"] == "prompt" for k in kb)


def test_redeploy_is_a_no_op(tenant_dir: Path) -> None:
    client = FakeElevenLabs()
    deploy(client, tenant_dir)
    client.calls.clear()
    deploy(client, tenant_dir)
    assert client.calls == []


def test_agent_found_by_name_when_id_not_committed(tenant_dir: Path) -> None:
    client = FakeElevenLabs()
    first = deploy(client, tenant_dir)
    assert deploy(client, tenant_dir) == first
    assert len(client.agents) == 1


def test_agent_found_by_committed_id(tenant_dir: Path) -> None:
    client = FakeElevenLabs()
    agent_id = deploy(client, tenant_dir)
    record_agent_id(tenant_dir / "tenant.yaml", agent_id)
    client.calls.clear()
    assert deploy(client, tenant_dir) == agent_id
    assert client.calls == []


def test_adding_a_listing(tenant_dir: Path) -> None:
    client = FakeElevenLabs()
    agent_id = deploy(client, tenant_dir)
    src = tenant_dir / "listings" / "gladstone-920-1.md"
    new = tenant_dir / "listings" / "gladstone-920-2.md"
    new.write_text(src.read_text().replace("id: gladstone-920-1", "id: gladstone-920-2"))
    client.calls.clear()

    deploy(client, tenant_dir)

    assert client.calls[0].startswith("kb.create leaseline/demo/gladstone-920-2@")
    assert client.calls[1:] == ["agent.update"]
    assert "gladstone-920-2" in listing_ids_on_agent(client, agent_id)


def test_editing_a_listing_swaps_its_doc_after_the_agent_update(tenant_dir: Path) -> None:
    client = FakeElevenLabs()
    agent_id = deploy(client, tenant_dir)
    path = tenant_dir / "listings" / "gladstone-920-1.md"
    path.write_text(path.read_text().replace("rent_monthly: 2695", "rent_monthly: 2650"))
    client.calls.clear()

    deploy(client, tenant_dir)

    assert [c.split(" ")[0] for c in client.calls] == ["kb.create", "agent.update", "kb.delete"]
    assert len(client.docs) == 2
    assert "$2,650" in "".join(d.text for d in client.docs.values())
    assert listing_ids_on_agent(client, agent_id) == {"gladstone-920-1", "icon-805-carling-1105"}


def test_removing_a_listing(tenant_dir: Path) -> None:
    client = FakeElevenLabs()
    extra = tenant_dir / "listings" / "gladstone-920-2.md"
    extra.write_text(
        (tenant_dir / "listings" / "gladstone-920-1.md")
        .read_text()
        .replace("id: gladstone-920-1", "id: gladstone-920-2")
    )
    agent_id = deploy(client, tenant_dir)
    extra.unlink()
    client.calls.clear()

    deploy(client, tenant_dir)

    assert [c.split(" ")[0] for c in client.calls] == ["agent.update", "kb.delete"]
    assert "gladstone-920-2" not in listing_ids_on_agent(client, agent_id)


def test_removing_half_the_listings_is_allowed(tenant_dir: Path) -> None:
    client = FakeElevenLabs()
    deploy(client, tenant_dir)
    (tenant_dir / "listings" / "icon-805-carling-1105.md").unlink()
    tenant, rendered = render(tenant_dir)
    plan = make_plan(client, tenant, rendered)
    assert plan.removed_listings == {"icon-805-carling-1105"}
    check_plan(plan)  # 1 of 2 is not "more than half"


def test_removing_most_listings_needs_the_flag(tenant_dir: Path) -> None:
    client = FakeElevenLabs()
    listings = tenant_dir / "listings"
    for i in range(2, 5):
        (listings / f"gladstone-920-{i}.md").write_text(
            (listings / "gladstone-920-1.md")
            .read_text()
            .replace("id: gladstone-920-1", f"id: gladstone-920-{i}")
        )
    deploy(client, tenant_dir)
    for i in range(2, 5):
        (listings / f"gladstone-920-{i}.md").unlink()

    with pytest.raises(DeployError, match="refusing to remove 3 of 5"):
        deploy(client, tenant_dir)
    deploy(client, tenant_dir, allow_mass_delete=True)


def test_prompt_change_updates_agent_only(tenant_dir: Path) -> None:
    client = FakeElevenLabs()
    deploy(client, tenant_dir)
    tenant, rendered = render(tenant_dir)
    changed = RenderedAgent(
        prompt=rendered.prompt + "\nBe extra brief.\n",
        first_message=rendered.first_message,
        kb_docs=rendered.kb_docs,
        client_tools=rendered.client_tools,
        config=rendered.config,
    )
    client.calls.clear()
    plan = make_plan(client, tenant, changed)
    assert plan.agent_action == "update"
    apply_plan(client, plan, changed)
    assert client.calls == ["agent.update"]


def test_duplicate_agent_names_are_an_error(tenant_dir: Path) -> None:
    client = FakeElevenLabs()
    deploy(client, tenant_dir)
    tenant, rendered = render(tenant_dir)
    client._agents_create(
        name="LeaseLine · demo",
        tags=[],
        conversation_config=next(iter(client.agents.values())).conversation_config,
        platform_settings=next(iter(client.agents.values())).platform_settings,
    )
    with pytest.raises(DeployError, match="2 agents are named"):
        make_plan(client, tenant, rendered)


def test_record_agent_id_keeps_comments(tmp_path: Path) -> None:
    path = tmp_path / "tenant.yaml"
    path.write_text("slug: demo\nagent_id: null # set by deploy\nfoo: 1\n")
    assert record_agent_id(path, "agent_123") is True
    assert path.read_text() == "slug: demo\nagent_id: agent_123 # set by deploy\nfoo: 1\n"
    assert record_agent_id(path, "agent_123") is False
