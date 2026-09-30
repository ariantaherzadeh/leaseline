"""Build the ElevenLabs agent payload from a rendered tenant. Pure: no API calls.

The payload is plain dicts in the REST API's shape. Tests validate it against the SDK's
Pydantic models, so schema mistakes are caught offline.
"""

from typing import Any

from leaseline.models import Tenant
from leaseline.render import RenderedAgent

GUARDRAIL_MODEL = "gemini-2.5-flash-lite"

# System tools go in `tools` with type "system"; `built_in_tools` is the legacy location.
END_CALL_TOOL = {
    "type": "system",
    "name": "end_call",
    "description": "End the call once the renter is done, or if they are abusive.",
    "params": {"system_tool_type": "end_call"},
}


def agent_name(tenant: Tenant) -> str:
    return f"LeaseLine · {tenant.slug}"


def agent_tags(tenant: Tenant) -> list[str]:
    return ["leaseline", f"tenant:{tenant.slug}"]


def knowledge_base_locators(kb_ids: dict[str, str]) -> list[dict[str, Any]]:
    """KB docs attached in full to every turn (`usage_mode: prompt`), sorted for stable diffs.

    With a handful of short listings, full inclusion beats retrieval: nothing can be missed on a
    live call. Switch to RAG (`usage_mode: auto`) once a tenant has dozens of listings.
    """
    return [
        {"type": "text", "name": name, "id": doc_id, "usage_mode": "prompt"}
        for name, doc_id in sorted(kb_ids.items())
    ]


def conversation_config(
    tenant: Tenant, rendered: RenderedAgent, kb_ids: dict[str, str]
) -> dict[str, Any]:
    cfg = rendered.config
    return {
        "agent": {
            "first_message": rendered.first_message,
            "language": "en",
            "prompt": {
                "prompt": rendered.prompt,
                "llm": cfg["llm"]["model"],
                "temperature": cfg["llm"]["temperature"],
                "tools": [*rendered.client_tools, END_CALL_TOOL],
                "knowledge_base": knowledge_base_locators(kb_ids),
                "rag": {"enabled": False},
            },
        },
        "tts": {
            "model_id": cfg["tts"]["model_id"],
            "voice_id": tenant.persona.voice_id,
            "stability": cfg["tts"]["stability"],
            "similarity_boost": cfg["tts"]["similarity_boost"],
            "speed": cfg["tts"]["speed"],
        },
        "turn": dict(cfg["turn"]),
        "conversation": {"max_duration_seconds": cfg["conversation"]["max_duration_seconds"]},
    }


def _custom_guardrail(rule: dict[str, str]) -> dict[str, Any]:
    return {
        "is_enabled": True,
        "name": rule["name"],
        "prompt": rule["prompt"],
        "execution_mode": "blocking",
        "model": GUARDRAIL_MODEL,
        "history_message_count": 1,
        "trigger_action": {"type": "retry", "feedback": "Reason: {{trigger_reason}}"},
    }


BRASS = "#B08D57"  # matches --brass in web/src/app/globals.css


def widget_settings(tenant: Tenant) -> dict[str, Any]:
    """The embed widget reads its look and copy from the agent, not from HTML attributes."""
    name, accent = tenant.persona.name, tenant.brand.accent
    return {
        "avatar": {"type": "orb", "color_1": accent, "color_2": BRASS},
        "transcript_enabled": True,
        "text_contents": {
            "main_label": f"Talk to {name}",
            "start_call": "Start call",
            "end_call": "End call",
            "listening_status": "Listening",
            "speaking_status": f"{name} is talking",
            "connecting_status": "Connecting",
        },
        "styles": {"accent": accent, "accent_primary": "#FFFFFF"},
    }


def platform_settings(tenant: Tenant, rendered: RenderedAgent) -> dict[str, Any]:
    cfg = rendered.config
    guardrails = cfg["guardrails"]
    return {
        # Public agent (the widget needs no signed URL), locked to the tenant's domains.
        "auth": {
            "enable_auth": False,
            "allowlist": [{"hostname": d} for d in tenant.domains],
        },
        "call_limits": dict(cfg["call_limits"]),
        "widget": widget_settings(tenant),
        "privacy": {"retention_days": cfg["privacy"]["retention_days"]},
        "summary_language": "en",
        "guardrails": {
            "version": "1",
            "focus": {"is_enabled": guardrails["focus"]},
            "prompt_injection": {"is_enabled": guardrails["prompt_injection"]},
            "custom": {"config": {"configs": [_custom_guardrail(r) for r in guardrails["custom"]]}},
        },
        "data_collection": {
            key: {"type": spec["type"], "description": spec["description"]}
            for key, spec in cfg["data_collection"].items()
        },
        "evaluation": {
            "criteria": [
                {
                    "id": key,
                    "name": key.replace("_", " ").capitalize(),
                    "type": "prompt",
                    "conversation_goal_prompt": prompt,
                }
                for key, prompt in cfg["evaluation"].items()
            ]
        },
    }
