import hashlib
import hmac
from types import SimpleNamespace

import pytest

from leaseline import webhook


def test_sign_matches_elevenlabs_scheme() -> None:
    header = webhook.sign('{"a":1}', "secret", timestamp=1_790_000_000)
    t, v0 = header.split(",")
    assert t == "t=1790000000"
    expected = hmac.new(b"secret", b'1790000000.{"a":1}', hashlib.sha256).hexdigest()
    assert v0 == f"v0={expected}"


class FakeClient:
    def __init__(self, existing: bool) -> None:
        url = webhook.function_url("ref")
        hooks = [SimpleNamespace(name=webhook.WEBHOOK_NAME, webhook_url=url, webhook_id="wh_old")]
        self.calls: list[str] = []
        self.webhooks = SimpleNamespace(
            list=lambda: SimpleNamespace(webhooks=hooks if existing else []),
            create=self._create,
            delete=lambda webhook_id: self.calls.append(f"delete {webhook_id}"),
        )
        self.conversational_ai = SimpleNamespace(
            settings=SimpleNamespace(update=lambda **kw: self.calls.append(f"attach {kw}"))
        )

    def _create(self, settings: dict) -> SimpleNamespace:
        self.calls.append(f"create {settings['webhook_url']}")
        return SimpleNamespace(webhook_id="wh_new", webhook_secret="s3cret")


@pytest.fixture
def no_network(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    seen: list[str] = []
    monkeypatch.setattr(webhook, "_store_secret", lambda ref, token, secret: seen.append(secret))
    monkeypatch.setattr(webhook, "_self_test", lambda url, secret: "ok")
    monkeypatch.setattr(webhook.time, "sleep", lambda s: None)
    return seen


def test_creates_webhook_stores_secret_and_attaches(no_network: list[str]) -> None:
    client = FakeClient(existing=False)
    result = webhook.setup(client, "ref", "token")
    assert result.created and result.webhook_id == "wh_new" and result.self_test == "ok"
    assert no_network == ["s3cret"]
    assert client.calls[0].startswith("create https://ref.supabase.co/functions/v1/ingest-lead")
    assert "'post_call_webhook_id': 'wh_new'" in client.calls[-1]


def test_existing_webhook_is_kept(no_network: list[str]) -> None:
    client = FakeClient(existing=True)
    result = webhook.setup(client, "ref", "token")
    assert not result.created and result.webhook_id == "wh_old"
    assert no_network == []


def test_rotate_replaces_webhook(no_network: list[str]) -> None:
    client = FakeClient(existing=True)
    result = webhook.setup(client, "ref", "token", rotate=True)
    assert client.calls[0] == "delete wh_old"
    assert result.webhook_id == "wh_new" and no_network == ["s3cret"]
