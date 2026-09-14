import logging
import pytest
from unittest.mock import AsyncMock, patch

from app.core.config import Settings, settings
from app.services.whatsapp.meta_provider import MetaCloudApiProvider, mask_phone_number


def test_mask_phone_number():
    """Verify phone masking protects PII and matches the required format."""
    # 12-digit Indian phone number (standard WhatsApp recipient)
    assert mask_phone_number("919234567869") == "9192******69"
    
    # E.164 with plus sign
    assert mask_phone_number("+919234567869") == "+9192******69"

    # 10-digit phone number
    assert mask_phone_number("9876543210") == "9876****10"

    # Short numbers (length <= 6)
    assert mask_phone_number("123456") == "******"
    assert mask_phone_number("123") == "***"

    # Empty or None
    assert mask_phone_number("") == ""
    assert mask_phone_number(None) == ""


def test_whatsapp_runtime_diagnostics_structure_and_safe_values(monkeypatch):
    """Verify runtime diagnostics returns literal values for configs and only SET/MISSING/EMPTY for secrets."""
    # Set explicit test values
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_BILLING_TEMPLATE", "service_completion_thank_you")
    monkeypatch.setattr(settings, "WHATSAPP_BILLING_PDF_TEMPLATE", "service_completion_thank_you_with_bill")
    monkeypatch.setattr(settings, "WHATSAPP_TEMPLATE_LANGUAGE", "en")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "100200300400")
    monkeypatch.setattr(settings, "WHATSAPP_BUSINESS_ACCOUNT_ID", "500600700800")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "EAAX_SUPER_SECRET_TOKEN_12345")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "919876543210")

    diag = settings.get_whatsapp_runtime_diagnostics()

    # Exact expected keys
    expected_keys = {
        "WHATSAPP_SENDER_MODE",
        "WHATSAPP_BILLING_TEMPLATE",
        "WHATSAPP_BILLING_PDF_TEMPLATE",
        "WHATSAPP_TEMPLATE_LANGUAGE",
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_BUSINESS_ACCOUNT_ID",
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_TEST_RECIPIENT_PHONE",
    }
    assert set(diag.keys()) == expected_keys

    # Configs must match exact string values
    assert diag["WHATSAPP_SENDER_MODE"] == "platform"
    assert diag["WHATSAPP_BILLING_TEMPLATE"] == "service_completion_thank_you"
    assert diag["WHATSAPP_BILLING_PDF_TEMPLATE"] == "service_completion_thank_you_with_bill"
    assert diag["WHATSAPP_TEMPLATE_LANGUAGE"] == "en"

    # Sensitive fields must ONLY be SET / MISSING / EMPTY
    sensitive_keys = [
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_BUSINESS_ACCOUNT_ID",
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_TEST_RECIPIENT_PHONE",
    ]
    for k in sensitive_keys:
        assert diag[k] in {"SET", "MISSING", "EMPTY"}, f"{k} value was {diag[k]} instead of SET/MISSING/EMPTY"
        assert diag[k] == "SET"

    # CRITICAL: Raw token and phone values must NEVER appear anywhere in the diagnostics output
    for k, v in diag.items():
        assert "EAAX_SUPER_SECRET_TOKEN_12345" not in v
        assert "100200300400" not in v
        assert "500600700800" not in v
        assert "919876543210" not in v


def test_whatsapp_runtime_diagnostics_missing_and_empty_states(monkeypatch):
    """Verify MISSING (absent) vs EMPTY (blank) states are distinguished correctly."""
    # 1. Missing state: deleted from os.environ and empty string in settings
    monkeypatch.delenv("WHATSAPP_PHONE_NUMBER_ID", raising=False)
    monkeypatch.delenv("WHATSAPP_BUSINESS_ACCOUNT_ID", raising=False)
    monkeypatch.delenv("WHATSAPP_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("WHATSAPP_TEST_RECIPIENT_PHONE", raising=False)

    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
    monkeypatch.setattr(settings, "WHATSAPP_BUSINESS_ACCOUNT_ID", "")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    diag_missing = settings.get_whatsapp_runtime_diagnostics()
    assert diag_missing["WHATSAPP_PHONE_NUMBER_ID"] == "MISSING"
    assert diag_missing["WHATSAPP_BUSINESS_ACCOUNT_ID"] == "MISSING"
    assert diag_missing["WHATSAPP_ACCESS_TOKEN"] == "MISSING"
    assert diag_missing["WHATSAPP_TEST_RECIPIENT_PHONE"] == "MISSING"

    # 2. Empty state: explicitly present in os.environ with empty/whitespace string
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_ID", "")
    monkeypatch.setenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "   ")
    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "")
    monkeypatch.setenv("WHATSAPP_TEST_RECIPIENT_PHONE", " ")

    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "")
    monkeypatch.setattr(settings, "WHATSAPP_BUSINESS_ACCOUNT_ID", "")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    diag_empty = settings.get_whatsapp_runtime_diagnostics()
    assert diag_empty["WHATSAPP_PHONE_NUMBER_ID"] == "EMPTY"
    assert diag_empty["WHATSAPP_BUSINESS_ACCOUNT_ID"] == "EMPTY"
    assert diag_empty["WHATSAPP_ACCESS_TOKEN"] == "EMPTY"
    assert diag_empty["WHATSAPP_TEST_RECIPIENT_PHONE"] == "EMPTY"


@pytest.mark.asyncio
async def test_meta_provider_outbound_log_and_unaltered_payload(caplog):
    """Verify outbound log includes template_name, language_code, phone_number_id, masked recipient,
    and outgoing payload to Meta remains intact without alteration."""
    caplog.set_level(logging.INFO, logger="whatsapp.meta")

    provider = MetaCloudApiProvider(api_version="v20.0")

    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "messaging_product": "whatsapp",
        "contacts": [{"input": "919234567869", "wa_id": "919234567869"}],
        "messages": [{"id": "wamid.HBgLM...="}],
    }

    posted_payload = {}
    posted_url = ""

    async def fake_post(url, json=None, headers=None):
        nonlocal posted_payload, posted_url
        posted_url = url
        posted_payload = json
        return mock_response

    with patch("httpx.AsyncClient.post", side_effect=fake_post):
        result = await provider.send_template_message(
            phone_number_id="101010101010",
            access_token="test-access-token",
            to_phone="919234567869",
            template_name="service_completion_thank_you",
            language_code="en",
            components=[{"type": "body", "parameters": [{"type": "text", "text": "Customer"}]}],
        )

    assert result["success"] is True
    assert result["wamid"] == "wamid.HBgLM...="

    # 1. Verify outbound log message structure
    outbound_logs = [r.message for r in caplog.records if "[Meta Cloud API] Outbound template send" in r.message]
    assert len(outbound_logs) == 1
    log_msg = outbound_logs[0]

    # Verify all 4 required fields are logged
    assert "to=9192******69" in log_msg
    assert "template=service_completion_thank_you" in log_msg
    assert "language=en" in log_msg
    assert "phone_id=101010101010" in log_msg

    # Verify unmasked customer phone number is NOT logged in the outbound send message
    assert "to=919234567869" not in log_msg

    # 2. Verify payload sent to Meta Graph API was NOT altered or masked
    assert posted_url == "https://graph.facebook.com/v20.0/101010101010/messages"
    assert posted_payload["messaging_product"] == "whatsapp"
    assert posted_payload["recipient_type"] == "individual"
    assert posted_payload["to"] == "919234567869"  # Raw, intact phone number sent to Meta
    assert posted_payload["type"] == "template"
    assert posted_payload["template"]["name"] == "service_completion_thank_you"
    assert posted_payload["template"]["language"] == {"code": "en"}
    assert posted_payload["template"]["components"] == [
        {"type": "body", "parameters": [{"type": "text", "text": "Customer"}]}
    ]
