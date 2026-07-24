"""Unit tests for Resend email helpers (no live API calls)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.config import Settings
from app.services import email_service


def test_resend_from_builds_display_name_header():
    s = Settings(
        RESEND_FROM_NAME="MyChair",
        RESEND_FROM_EMAIL="support@mychair.co.in",
        RESEND_API_KEY="re_test",
    )
    assert s.resend_from == "MyChair <support@mychair.co.in>"


def test_validate_recipient_requires_preferred_email():
    assert email_service._validate_recipient(None)[1] == "Preferred email is required"
    assert email_service._validate_recipient("   ")[1] == "Preferred email is required"
    assert email_service._validate_recipient("not-an-email")[1] == "Preferred email is invalid"
    cleaned, err = email_service._validate_recipient("  owner@salon.com ")
    assert err is None
    assert cleaned == "owner@salon.com"


@pytest.mark.asyncio
async def test_send_email_rejects_missing_preferred_email(monkeypatch):
    monkeypatch.setattr(email_service.settings, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(email_service.settings, "RESEND_FROM_EMAIL", "support@mychair.co.in")
    monkeypatch.setattr(email_service.settings, "RESEND_FROM_NAME", "MyChair")

    ok, err, msg_id = await email_service.send_email(
        to_email="",
        subject="Test",
        html="<p>hi</p>",
    )
    assert ok is False
    assert err == "Preferred email is required"
    assert msg_id is None


@pytest.mark.asyncio
async def test_send_email_uses_env_sender_and_preferred_recipient(monkeypatch):
    monkeypatch.setattr(email_service.settings, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(email_service.settings, "RESEND_FROM_EMAIL", "support@mychair.co.in")
    monkeypatch.setattr(email_service.settings, "RESEND_FROM_NAME", "MyChair")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"id": "email_123"}
    mock_response.text = "{}"

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.email_service.httpx.AsyncClient", return_value=mock_client):
        ok, err, msg_id = await email_service.send_email(
            to_email="preferred@example.com",
            subject="Invite",
            html="<p>invite</p>",
        )

    assert ok is True
    assert err is None
    assert msg_id == "email_123"
    payload = mock_client.post.call_args.kwargs["json"]
    assert payload["from"] == "MyChair <support@mychair.co.in>"
    assert payload["to"] == ["preferred@example.com"]
    assert payload["reply_to"] == "support@mychair.co.in"
