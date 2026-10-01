import json

import httpx
import pytest

from leaseline import supabase_admin
from leaseline.supabase_admin import Project, SupabaseAdminError


def fake_supabase(monkeypatch: pytest.MonkeyPatch, *, user_exists: bool = False) -> list[str]:
    """Route every httpx.Client in the module through an in-memory Supabase."""
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        path, method = request.url.path, request.method
        seen.append(f"{method} {path}")
        if path.endswith("/api-keys"):
            return httpx.Response(
                200,
                json=[
                    {"type": "publishable", "api_key": "pub"},
                    {"type": "secret", "api_key": "sb_secret_x"},
                ],
            )
        if path.endswith("/config/auth"):
            return httpx.Response(200, json={})
        if path == "/auth/v1/admin/users" and method == "POST":
            assert request.headers["apikey"] == "sb_secret_x"
            if user_exists:
                return httpx.Response(
                    422, json={"msg": "A user with this email address has already been registered"}
                )
            return httpx.Response(200, json={"id": "user-new"})
        if path == "/auth/v1/admin/users" and method == "GET":
            return httpx.Response(
                200, json={"users": [{"id": "user-old", "email": "Jane@Example.com"}]}
            )
        if path == "/rest/v1/tenants":
            return httpx.Response(
                200, json=[{"id": "tenant-1"}] if "eq.demo" in str(request.url) else []
            )
        if path == "/rest/v1/team_members":
            body = json.loads(request.content)
            seen.append(f"member {body['user_id']} {body['role']}")
            return httpx.Response(201)
        return httpx.Response(404)

    real_client = httpx.Client
    monkeypatch.setattr(
        supabase_admin.httpx,
        "Client",
        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
    )
    return seen


def test_add_member_creates_user_and_membership(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = fake_supabase(monkeypatch)
    user_id, created = Project("ref", "pat").add_member("jane@example.com", "demo", "admin")
    assert (user_id, created) == ("user-new", True)
    assert "member user-new admin" in seen


def test_add_member_reuses_existing_user(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = fake_supabase(monkeypatch, user_exists=True)
    user_id, created = Project("ref", "pat").add_member("jane@example.com", "demo", "editor")
    assert (user_id, created) == ("user-old", False)
    assert "member user-old editor" in seen


def test_add_member_rejects_unknown_tenant_and_role(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_supabase(monkeypatch)
    with pytest.raises(SupabaseAdminError, match="No tenant"):
        Project("ref", "pat").add_member("jane@example.com", "nope", "editor")
    with pytest.raises(SupabaseAdminError, match="role must be"):
        Project("ref", "pat").add_member("jane@example.com", "demo", "owner")


def test_configure_auth_is_invite_only(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = fake_supabase(monkeypatch)
    settings = Project("ref", "pat").configure_auth()
    assert settings["disable_signup"] is True
    allowed = settings["uri_allow_list"].split(",")
    assert "https://app.tryleaseline.com/auth/callback" in allowed
    assert "https://leaseline-app.netlify.app/auth/callback" in allowed
    assert "PATCH /v1/projects/ref/config/auth" in seen
