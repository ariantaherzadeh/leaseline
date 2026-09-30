"""Sync a tenant from the repo to ElevenLabs. Stateless, idempotent, safe to re-run.

How state is found without a state file:
- KB docs: every doc LeaseLine creates is named ``leaseline/<tenant>/<listing>@<hash>``. Listing
  those names and comparing them to the rendered docs yields exactly what to add and remove.
- Agent: found by ``tenant.agent_id``, or by its name and tags if the id isn't committed yet.
  A config fingerprint stored as a tag tells whether the agent needs updating.

Apply order keeps live calls safe: create new docs → update the agent → delete stale docs.
"""

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from leaseline.models import Tenant
from leaseline.payload import agent_name, agent_tags, conversation_config, platform_settings
from leaseline.render import KbDoc, RenderedAgent

FINGERPRINT_TAG = "config:"
PLACEHOLDER_KB_ID = "pending"


class DeployError(Exception):
    """A deploy that must not proceed."""


class Client(Protocol):
    """The slice of `elevenlabs.ElevenLabs` that deploy uses (lets tests pass a fake)."""

    conversational_ai: Any


def kb_prefix(tenant: Tenant) -> str:
    return f"leaseline/{tenant.slug}/"


def listing_id_from_doc_name(name: str) -> str:
    return name.rsplit("/", 1)[-1].split("@", 1)[0]


@dataclass
class Plan:
    tenant: Tenant
    kb_create: list[KbDoc] = field(default_factory=list)
    kb_keep: dict[str, str] = field(default_factory=dict)  # name -> id
    kb_delete: dict[str, str] = field(default_factory=dict)  # name -> id
    agent_id: str | None = None
    agent_action: str = "none"  # create | update | none
    fingerprint: str = ""

    @property
    def removed_listings(self) -> set[str]:
        existing = {listing_id_from_doc_name(n) for n in self.kb_keep | self.kb_delete}
        desired = {doc.listing_id for doc in self.kb_create} | {
            listing_id_from_doc_name(n) for n in self.kb_keep
        }
        return existing - desired

    @property
    def has_changes(self) -> bool:
        return bool(self.kb_create or self.kb_delete) or self.agent_action != "none"

    def summary(self) -> list[str]:
        lines = []
        existing = {listing_id_from_doc_name(n) for n in self.kb_keep | self.kb_delete}
        for doc in self.kb_create:
            verb = "~ update" if doc.listing_id in existing else "+ add"
            lines.append(f"{verb} listing {doc.listing_id}")
        lines += [f"- remove listing {listing_id}" for listing_id in sorted(self.removed_listings)]
        if self.agent_action == "create":
            lines.append(f"+ create agent {agent_name(self.tenant)!r}")
        elif self.agent_action == "update":
            lines.append(f"~ update agent {self.agent_id}")
        return lines or ["no changes"]


def _paginate(list_fn: Any, items_attr: str, **kwargs: Any) -> list[Any]:
    items, cursor = [], None
    while True:
        page = list_fn(cursor=cursor, **kwargs) if cursor else list_fn(**kwargs)
        items += getattr(page, items_attr)
        if not getattr(page, "has_more", False):
            return items
        cursor = page.next_cursor


def existing_kb_docs(client: Client, tenant: Tenant) -> dict[str, str]:
    prefix = kb_prefix(tenant)
    docs = _paginate(
        client.conversational_ai.knowledge_base.list,
        "documents",
        search=prefix,
        page_size=100,
    )
    return {d.name: d.id for d in docs if d.name.startswith(prefix)}


def find_agent(client: Client, tenant: Tenant) -> tuple[str | None, list[str]]:
    """Return (agent_id, tags) for the tenant's agent, or (None, [])."""
    agents = client.conversational_ai.agents
    if tenant.agent_id:
        agent = agents.get(agent_id=tenant.agent_id)
        return agent.agent_id, list(getattr(agent, "tags", None) or [])
    name = agent_name(tenant)
    matches = [
        a for a in _paginate(agents.list, "agents", search=name, page_size=100) if a.name == name
    ]
    if len(matches) > 1:
        raise DeployError(
            f"{len(matches)} agents are named {name!r}; set agent_id in tenant.yaml to pick one"
        )
    if not matches:
        return None, []
    return matches[0].agent_id, list(getattr(matches[0], "tags", None) or [])


def payload(
    tenant: Tenant, rendered: RenderedAgent, kb_ids: dict[str, str]
) -> tuple[dict[str, Any], dict[str, Any]]:
    return conversation_config(tenant, rendered, kb_ids), platform_settings(tenant, rendered)


def fingerprint(tenant: Tenant, rendered: RenderedAgent) -> str:
    """Hash of everything we send to the agent, independent of server-assigned KB ids."""
    kb_ids = {doc.name: PLACEHOLDER_KB_ID for doc in rendered.kb_docs}
    conv, platform = payload(tenant, rendered, kb_ids)
    blob = json.dumps(
        {"conv": conv, "platform": platform, "name": agent_name(tenant)}, sort_keys=True
    )
    return hashlib.sha256(blob.encode()).hexdigest()[:12]


def make_plan(client: Client, tenant: Tenant, rendered: RenderedAgent) -> Plan:
    existing = existing_kb_docs(client, tenant)
    desired = {doc.name for doc in rendered.kb_docs}
    plan = Plan(
        tenant=tenant,
        kb_create=[doc for doc in rendered.kb_docs if doc.name not in existing],
        kb_keep={n: i for n, i in existing.items() if n in desired},
        kb_delete={n: i for n, i in existing.items() if n not in desired},
        fingerprint=fingerprint(tenant, rendered),
    )
    plan.agent_id, tags = find_agent(client, tenant)
    if plan.agent_id is None:
        plan.agent_action = "create"
    elif f"{FINGERPRINT_TAG}{plan.fingerprint}" not in tags or plan.kb_create or plan.kb_delete:
        plan.agent_action = "update"
    return plan


def check_plan(plan: Plan, allow_mass_delete: bool = False) -> None:
    existing = {listing_id_from_doc_name(n) for n in plan.kb_keep | plan.kb_delete}
    removed = plan.removed_listings
    if existing and len(removed) > len(existing) / 2 and not allow_mass_delete:
        raise DeployError(
            f"refusing to remove {len(removed)} of {len(existing)} listings "
            f"({', '.join(sorted(removed))}); re-run with --allow-mass-delete if intended"
        )


def apply_plan(client: Client, plan: Plan, rendered: RenderedAgent) -> str:
    """Execute a plan. Returns the agent id."""
    ca = client.conversational_ai
    kb_ids = dict(plan.kb_keep)
    for doc in plan.kb_create:
        created = ca.knowledge_base.documents.create_from_text(text=doc.text, name=doc.name)
        kb_ids[doc.name] = created.id

    conv, platform = payload(plan.tenant, rendered, kb_ids)
    tags = [*agent_tags(plan.tenant), f"{FINGERPRINT_TAG}{plan.fingerprint}"]
    agent_id = plan.agent_id
    if plan.agent_action == "create":
        agent_id = ca.agents.create(
            name=agent_name(plan.tenant),
            tags=tags,
            conversation_config=conv,
            platform_settings=platform,
        ).agent_id
    elif plan.agent_action == "update":
        ca.agents.update(
            agent_id=agent_id,
            name=agent_name(plan.tenant),
            tags=tags,
            conversation_config=conv,
            platform_settings=platform,
        )

    for doc_id in plan.kb_delete.values():
        ca.knowledge_base.documents.delete(documentation_id=doc_id)

    assert agent_id is not None
    return agent_id


def record_agent_id(tenant_file: Path, agent_id: str) -> bool:
    """Write agent_id into tenant.yaml, keeping comments. Returns True if the file changed."""
    text = tenant_file.read_text(encoding="utf-8")
    new, count = re.subn(r"^agent_id:[ \t]*\S+", f"agent_id: {agent_id}", text, flags=re.M)
    if count != 1:
        raise DeployError(f"{tenant_file}: expected exactly one 'agent_id:' line")
    if new == text:
        return False
    tenant_file.write_text(new, encoding="utf-8")
    return True
