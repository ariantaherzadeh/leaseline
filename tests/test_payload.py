from pathlib import Path

import pytest
from elevenlabs.types import AgentPlatformSettingsRequestModel, ConversationalConfig

from leaseline.loader import validate_tenant
from leaseline.payload import conversation_config, platform_settings

REPO_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def payloads() -> tuple[dict, dict]:
    from leaseline.render import render_agent

    report = validate_tenant(REPO_ROOT / "tenants" / "demo")
    rendered = render_agent(report.tenant, report.listings, REPO_ROOT / "agent")
    kb_ids = {doc.name: f"doc_{i}" for i, doc in enumerate(rendered.kb_docs)}
    return conversation_config(report.tenant, rendered, kb_ids), platform_settings(
        report.tenant, rendered
    )


def test_payload_matches_sdk_schema(payloads: tuple[dict, dict]) -> None:
    conv, platform = payloads
    ConversationalConfig.model_validate(conv)
    AgentPlatformSettingsRequestModel.model_validate(platform)


def test_agent_is_public_but_domain_locked(payloads: tuple[dict, dict]) -> None:
    _, platform = payloads
    assert platform["auth"]["enable_auth"] is False
    assert platform["auth"]["allowlist"] == [
        {"hostname": "leaseline.netlify.app"},
        {"hostname": "localhost"},
    ]


def test_cost_limits(payloads: tuple[dict, dict]) -> None:
    conv, platform = payloads
    assert conv["conversation"]["max_duration_seconds"] <= 600
    assert platform["call_limits"]["bursting_enabled"] is False


def test_tools_include_end_call_as_system_tool(payloads: tuple[dict, dict]) -> None:
    conv, _ = payloads
    tools = {t["name"]: t["type"] for t in conv["agent"]["prompt"]["tools"]}
    assert tools == {
        "show_listing": "client",
        "show_showing_request": "client",
        "end_call": "system",
    }
    assert "built_in_tools" not in conv["agent"]["prompt"]


def test_knowledge_base_fully_included(payloads: tuple[dict, dict]) -> None:
    conv, _ = payloads
    prompt = conv["agent"]["prompt"]
    assert prompt["rag"] == {"enabled": False}
    assert [k["usage_mode"] for k in prompt["knowledge_base"]] == ["prompt", "prompt"]


def test_guardrails_enabled(payloads: tuple[dict, dict]) -> None:
    _, platform = payloads
    guardrails = platform["guardrails"]
    assert guardrails["focus"]["is_enabled"] and guardrails["prompt_injection"]["is_enabled"]
    names = [c["name"] for c in guardrails["custom"]["config"]["configs"]]
    assert "Fair housing (no steering)" in names


def test_widget_is_branded_for_the_persona(payloads: tuple[dict, dict]) -> None:
    _, platform = payloads
    widget = platform["widget"]
    assert widget["text_contents"]["main_label"] == "Talk to Nora"
    assert widget["avatar"]["color_1"] == "#0E7C66"
