"""Supabase project administration that needs elevated keys: auth settings and team membership.

Uses SUPABASE_ACCESS_TOKEN (a personal access token scoped to the project) with the Management
API. The project's secret API key is fetched at runtime for the Auth admin calls and is never
printed or stored.
"""

from dataclasses import dataclass
from typing import Any

import httpx

MANAGEMENT_API = "https://api.supabase.com/v1"
DASHBOARD_URL = "https://app.tryleaseline.com"
# Netlify's own address for the dashboard site: works before (and alongside) the custom domain.
NETLIFY_DASHBOARD_URL = "https://leaseline-app.netlify.app"
LOCAL_DASHBOARD_URL = "http://localhost:3001"
ROLES = ("admin", "editor", "viewer")


class SupabaseAdminError(Exception):
    """An admin operation that failed."""


def _check(res: httpx.Response, what: str) -> Any:
    if res.status_code >= 300:
        raise SupabaseAdminError(f"{what} failed ({res.status_code}): {res.text[:300]}")
    return res.json() if res.content else None


@dataclass
class Project:
    ref: str
    access_token: str

    @property
    def url(self) -> str:
        return f"https://{self.ref}.supabase.co"

    def _mgmt(self) -> httpx.Client:
        return httpx.Client(
            base_url=f"{MANAGEMENT_API}/projects/{self.ref}",
            headers={"Authorization": f"Bearer {self.access_token}"},
            timeout=30,
        )

    def secret_key(self) -> str:
        with self._mgmt() as api:
            keys = _check(api.get("/api-keys", params={"reveal": "true"}), "Reading API keys")
        for key in keys:
            if key.get("type") == "secret" and key.get("api_key"):
                return key["api_key"]
        raise SupabaseAdminError("No secret API key found on the project")

    def configure_auth(self) -> dict[str, Any]:
        """Invite-only email login, redirecting to the dashboard (production and local)."""
        settings = {
            "disable_signup": True,
            "external_email_enabled": True,
            "site_url": DASHBOARD_URL,
            "uri_allow_list": ",".join(
                f"{url}/auth/callback"
                for url in (DASHBOARD_URL, NETLIFY_DASHBOARD_URL, LOCAL_DASHBOARD_URL)
            ),
            "mailer_otp_exp": 3600,
        }
        with self._mgmt() as api:
            _check(api.patch("/config/auth", json=settings), "Updating auth settings")
        return settings

    def add_member(self, email: str, tenant_slug: str, role: str) -> tuple[str, bool]:
        """Create (or find) the auth user and make them a member of the tenant.
        Returns (user_id, created)."""
        if role not in ROLES:
            raise SupabaseAdminError(f"role must be one of {', '.join(ROLES)}")
        key = self.secret_key()
        headers = {"apikey": key, "Content-Type": "application/json"}
        with httpx.Client(base_url=self.url, headers=headers, timeout=30) as api:
            created = True
            res = api.post("/auth/v1/admin/users", json={"email": email, "email_confirm": True})
            if res.status_code == 422 and "already" in res.text.lower():
                created = False
                users = _check(
                    api.get("/auth/v1/admin/users", params={"per_page": 1000}), "Listing users"
                )
                matches = [
                    u for u in users.get("users", []) if u.get("email", "").lower() == email.lower()
                ]
                if not matches:
                    raise SupabaseAdminError(f"{email} exists but could not be found")
                user_id = matches[0]["id"]
            else:
                user_id = _check(res, "Creating user")["id"]

            tenants = _check(
                api.get("/rest/v1/tenants", params={"slug": f"eq.{tenant_slug}", "select": "id"}),
                "Finding tenant",
            )
            if not tenants:
                raise SupabaseAdminError(f"No tenant {tenant_slug!r} in Supabase")
            _check(
                api.post(
                    "/rest/v1/team_members",
                    params={"on_conflict": "tenant_id,user_id"},
                    headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
                    json={"tenant_id": tenants[0]["id"], "user_id": user_id, "role": role},
                ),
                "Adding team member",
            )
        return user_id, created
