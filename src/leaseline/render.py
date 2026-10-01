"""Render a tenant into what the agent sees: system prompt, first message, KB docs, and tools.

Rendering is pure and offline. `deploy` sends these artifacts to ElevenLabs; `leaseline render`
writes them to disk so they can be reviewed before anything goes live.
"""

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined

from leaseline.models import TBD, Listing, Parking, Tenant

AGENT_DIR = Path("agent")  # shared prompt + config, relative to the repo root
NOT_CONFIRMED = "Not confirmed yet. Don't guess; offer a follow-up."


def _trim_float(value: float) -> str:
    return f"{value:g}"


def _fact(value: Any, suffix: str = "") -> str:
    if value == TBD:
        return NOT_CONFIRMED
    if value == "immediately":
        return "Immediately"
    return f"{value}{suffix}"


def _parking(value: Parking | str) -> str:
    if value == TBD:
        return NOT_CONFIRMED
    assert isinstance(value, Parking)
    if value.spots == 0:
        return "No parking"
    kind = f" {value.type}" if value.type else ""
    return f"{value.spots}{kind} spot{'s' if value.spots != 1 else ''}"


def _environment(agent_dir: Path) -> Environment:
    env = Environment(
        loader=FileSystemLoader(agent_dir),
        undefined=StrictUndefined,
        keep_trailing_newline=True,
        autoescape=False,  # plain text/Markdown for an LLM, not HTML
    )
    env.filters.update(trim_float=_trim_float, fact=_fact, parking=_parking)
    return env


@dataclass(frozen=True)
class KbDoc:
    listing_id: str
    name: str  # leaseline/<tenant>/<listing-id>@<hash>, used by deploy to diff
    text: str


@dataclass(frozen=True)
class RenderedAgent:
    prompt: str
    first_message: str
    kb_docs: list[KbDoc]
    client_tools: list[dict[str, Any]]
    config: dict[str, Any]


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:10]


def kb_doc_name(tenant_slug: str, listing_id: str, text: str) -> str:
    return f"leaseline/{tenant_slug}/{listing_id}@{content_hash(text)}"


def client_tools() -> list[dict[str, Any]]:
    """Browser-side tools the page implements (see site/app.js)."""
    # No enum: listings change in the dashboard without redeploying tools. The page ignores ids
    # it doesn't show, and the knowledge base gives the model the exact ids.
    listing_id_param = {
        "type": "string",
        "description": "The home's Listing ID, exactly as written in the knowledge base.",
    }
    # Filled in by ElevenLabs, not the model: lets the page open this call's leasing-team view.
    conversation_id_param = {"type": "string", "dynamic_variable": "system__conversation_id"}
    return [
        {
            "type": "client",
            "name": "show_listing",
            "description": (
                "Highlight a home's card on the renter's screen. Call it as you start "
                "recommending or describing a specific home."
            ),
            "expects_response": False,
            "parameters": {
                "type": "object",
                "properties": {
                    "listing_id": listing_id_param,
                    "conversation_id": conversation_id_param,
                },
                "required": ["listing_id"],
            },
        },
        {
            "type": "client",
            "name": "show_showing_request",
            "description": (
                "Show the renter a confirmation of their showing request, once you have their "
                "name, a confirmed phone number or email, and a preferred time."
            ),
            "expects_response": False,
            "parameters": {
                "type": "object",
                "properties": {
                    "listing_id": listing_id_param,
                    "conversation_id": conversation_id_param,
                    "name": {"type": "string", "description": "The renter's name."},
                    "contact": {
                        "type": "string",
                        "description": "The confirmed phone number or email.",
                    },
                    "preferred_time": {
                        "type": "string",
                        "description": "When they'd like to view the home, in their words.",
                    },
                },
                "required": ["listing_id", "name", "contact", "preferred_time"],
            },
        },
    ]


def render_agent(
    tenant: Tenant, listings: list[Listing], agent_dir: Path = AGENT_DIR
) -> RenderedAgent:
    env = _environment(agent_dir)
    context = {
        "persona": tenant.persona,
        "team": tenant.team,
        "follow_up": tenant.follow_up,
        "listings": listings,
    }
    kb_template = env.get_template("listing_kb.md.j2")
    kb_docs = []
    for listing in listings:
        text = kb_template.render(l=listing).strip() + "\n"
        kb_docs.append(KbDoc(listing.id, kb_doc_name(tenant.slug, listing.id, text), text))

    return RenderedAgent(
        prompt=env.get_template("prompt.md.j2").render(context).strip() + "\n",
        first_message=env.get_template("first_message.j2").render(context).strip(),
        kb_docs=kb_docs,
        client_tools=client_tools(),
        config=yaml.safe_load((agent_dir / "config.yaml").read_text(encoding="utf-8")),
    )


def write_build(rendered: RenderedAgent, out_dir: Path) -> list[Path]:
    """Write rendered artifacts for review. Returns the files written."""
    kb_dir = out_dir / "kb"
    kb_dir.mkdir(parents=True, exist_ok=True)
    for stale in kb_dir.glob("*.md"):
        stale.unlink()
    files = {
        out_dir / "prompt.md": rendered.prompt,
        out_dir / "first_message.txt": rendered.first_message + "\n",
        out_dir / "client_tools.json": json.dumps(rendered.client_tools, indent=2) + "\n",
        **{kb_dir / f"{doc.listing_id}.md": doc.text for doc in rendered.kb_docs},
    }
    for path, text in files.items():
        path.write_text(text, encoding="utf-8")
    return list(files)
