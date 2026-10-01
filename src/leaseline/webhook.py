"""Connect ElevenLabs' post-call webhook to the Supabase `ingest-lead` Edge Function.

The webhook's signing secret is shown by ElevenLabs exactly once, at creation. This module
creates the webhook and hands the secret straight to Supabase (Edge Function secrets) through
the Management API, so it never touches disk, logs, or a terminal.
"""

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any

import httpx

SUPABASE_API = "https://api.supabase.com/v1"
WEBHOOK_NAME = "LeaseLine post-call"
SECRET_NAME = "ELEVENLABS_WEBHOOK_SECRET"


class WebhookSetupError(Exception):
    """Setup that can't proceed safely."""


def function_url(project_ref: str) -> str:
    return f"https://{project_ref}.supabase.co/functions/v1/ingest-lead"


def sign(body: str, secret: str, timestamp: int | None = None) -> str:
    """The `elevenlabs-signature` header ElevenLabs would send for `body`."""
    t = int(time.time()) if timestamp is None else timestamp
    digest = hmac.new(secret.encode(), f"{t}.{body}".encode(), hashlib.sha256).hexdigest()
    return f"t={t},v0={digest}"


@dataclass
class SetupResult:
    webhook_id: str
    created: bool
    self_test: str


def _existing_webhook(client: Any, url: str) -> str | None:
    hooks = client.webhooks.list().webhooks
    for hook in hooks:
        if hook.name == WEBHOOK_NAME and hook.webhook_url == url:
            return hook.webhook_id
    return None


def _store_secret(project_ref: str, access_token: str, secret: str) -> None:
    res = httpx.post(
        f"{SUPABASE_API}/projects/{project_ref}/secrets",
        headers={"Authorization": f"Bearer {access_token}"},
        json=[{"name": SECRET_NAME, "value": secret}],
        timeout=30,
    )
    if res.status_code >= 300:
        raise WebhookSetupError(f"Supabase rejected the secret ({res.status_code}): {res.text}")


def _self_test(url: str, secret: str) -> str:
    """Send a signed event for an unknown agent: proves the signature path end to end without
    writing a lead."""
    body = json.dumps(
        {
            "type": "post_call_transcription",
            "data": {"conversation_id": "conv_selftest", "agent_id": "agent_selftest"},
        }
    )
    res = httpx.post(
        url, content=body, headers={"elevenlabs-signature": sign(body, secret)}, timeout=30
    )
    if res.status_code != 200:
        raise WebhookSetupError(f"self-test failed ({res.status_code}): {res.text}")
    return res.text


def setup(client: Any, project_ref: str, access_token: str, rotate: bool = False) -> SetupResult:
    url = function_url(project_ref)
    webhook_id = _existing_webhook(client, url)
    created = False
    test = "skipped (existing webhook; its secret can't be re-read; use --rotate to re-test)"

    if webhook_id and rotate:
        client.webhooks.delete(webhook_id=webhook_id)
        webhook_id = None

    if webhook_id is None:
        created_hook = client.webhooks.create(
            settings={"auth_type": "hmac", "name": WEBHOOK_NAME, "webhook_url": url}
        )
        webhook_id, secret = created_hook.webhook_id, created_hook.webhook_secret
        if not secret:
            raise WebhookSetupError("ElevenLabs did not return a webhook secret")
        _store_secret(project_ref, access_token, secret)
        # Secrets are live for Edge Functions immediately, but allow a moment to propagate.
        time.sleep(3)
        test = _self_test(url, secret)
        created = True

    client.conversational_ai.settings.update(
        webhooks={"post_call_webhook_id": webhook_id, "events": ["transcript"]}
    )
    return SetupResult(webhook_id=webhook_id, created=created, self_test=test)
