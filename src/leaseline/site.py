"""Export a tenant's branding and assistant settings as JSON for the public site (apps/site).

Listings are not exported: the site reads published listings from Supabase directly, so a
listing saved in the dashboard appears without a rebuild. No secrets here: the page only carries
the public agent id, and the agent itself is locked to the tenant's domains."""

import json
from pathlib import Path
from typing import Any

from leaseline.models import Tenant


class SiteError(Exception):
    """A site that can't be exported."""


def site_data(tenant: Tenant) -> dict[str, Any]:
    if not tenant.agent_id:
        raise SiteError(f"{tenant.slug} has no agent_id yet; run `leaseline deploy` first")
    return {
        "siteUrl": f"https://{tenant.domains[0]}",
        "tenantSlug": tenant.slug,
        "agentId": tenant.agent_id,
        "persona": {"name": tenant.persona.name},
        "team": {"name": tenant.team.name, "city": tenant.team.city},
        "brand": {"accent": tenant.brand.accent, "coBrand": tenant.brand.co_brand},
        "followUp": tenant.follow_up,
    }


def export_site(tenant: Tenant, out_file: Path) -> Path:
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(site_data(tenant), indent=2) + "\n", encoding="utf-8")
    return out_file
